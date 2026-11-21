package com.meditime.app;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import java.util.Calendar;

/**
 * BroadcastReceiver triggered by Android AlarmManager for exact alarm wake-ups
 * and handling notification/lock-screen action buttons.
 */
public class AlarmReceiver extends BroadcastReceiver {
    public static final String ACTION_TRIGGER_ALARM = "com.meditime.app.ACTION_TRIGGER_ALARM";
    public static final String ACTION_ALARM_TAKEN = "com.meditime.app.ACTION_ALARM_TAKEN";
    public static final String ACTION_ALARM_SNOOZE = "com.meditime.app.ACTION_ALARM_SNOOZE";
    public static final String ACTION_ALARM_STOP = "com.meditime.app.ACTION_ALARM_STOP";
    public static final String ACTION_ALARM_SKIP = "com.meditime.app.ACTION_ALARM_SKIP";

    public static final String EXTRA_ALARM_ID = "extra_alarm_id";
    public static final String ACTION_CLOSE_ALARM_ACTIVITY = "com.meditime.app.ACTION_CLOSE_ALARM_ACTIVITY";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String alarmId = intent.getStringExtra(EXTRA_ALARM_ID);
        AlarmStorage storage = new AlarmStorage(context);

        if (ACTION_TRIGGER_ALARM.equals(action)) {
            AlarmStorage.AlarmItem item = storage.getAlarm(alarmId);
            if (item == null) {
                // Fallback default item
                item = new AlarmStorage.AlarmItem();
                item.id = alarmId != null ? alarmId : "alarm_unknown";
                item.medicineName = "Scheduled Medicine";
                item.dosage = "";
                item.scheduledTime = "";
            }

            storage.setActiveRingingAlarm(item);

            // 1. Start persistent AlarmService with audio, vibration & foreground notification
            AlarmService.startAlarm(context, item);

            // 2. Launch AlarmActivity over the lock screen
            Intent activityIntent = new Intent(context, AlarmActivity.class);
            activityIntent.putExtra(AlarmService.EXTRA_ALARM_ID, item.id);
            activityIntent.putExtra(AlarmService.EXTRA_MED_NAME, item.medicineName);
            activityIntent.putExtra(AlarmService.EXTRA_DOSAGE, item.dosage);
            activityIntent.putExtra(AlarmService.EXTRA_TIME, item.scheduledTime);
            activityIntent.putExtra(AlarmService.EXTRA_INSTRUCTIONS, item.instructions);
            activityIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            context.startActivity(activityIntent);

        } else if (ACTION_ALARM_TAKEN.equals(action)) {
            handleAction(context, storage, "taken", alarmId);
        } else if (ACTION_ALARM_SNOOZE.equals(action)) {
            handleSnooze(context, storage, alarmId);
        } else if (ACTION_ALARM_STOP.equals(action)) {
            handleAction(context, storage, "stop", alarmId);
        } else if (ACTION_ALARM_SKIP.equals(action)) {
            handleAction(context, storage, "skip", alarmId);
        }
    }

    private void handleAction(Context context, AlarmStorage storage, String actionName, String alarmId) {
        // 1. Immediately stop audio and foreground service
        AlarmService.stopAlarm(context);

        // 2. Clear notification
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(AlarmService.NOTIFICATION_ID);
        }

        // 3. Clear active ringing alarm in storage
        storage.setActiveRingingAlarm(null);

        // 4. Enqueue action for PWA synchronization
        if (alarmId != null) {
            storage.enqueueAction(actionName, alarmId, System.currentTimeMillis());
        }

        // 5. Broadcast to close AlarmActivity
        Intent closeIntent = new Intent(ACTION_CLOSE_ALARM_ACTIVITY);
        context.sendBroadcast(closeIntent);

        // 6. Refresh Home Screen Widget
        MediTimeWidgetProvider.triggerUpdate(context);
    }

    private void handleSnooze(Context context, AlarmStorage storage, String alarmId) {
        // Stop current alarm playback
        AlarmService.stopAlarm(context);
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(AlarmService.NOTIFICATION_ID);
        }
        storage.setActiveRingingAlarm(null);

        if (alarmId != null) {
            storage.enqueueAction("snooze", alarmId, System.currentTimeMillis());
        }

        // Reschedule alarm 10 minutes in the future
        AlarmStorage.AlarmItem original = storage.getAlarm(alarmId);
        if (original != null) {
            long snoozeTimeMs = System.currentTimeMillis() + (10 * 60 * 1000);
            original.triggerTimeMs = snoozeTimeMs;
            storage.saveAlarm(original);
            scheduleNativeAlarm(context, original);
        }

        Intent closeIntent = new Intent(ACTION_CLOSE_ALARM_ACTIVITY);
        context.sendBroadcast(closeIntent);
        MediTimeWidgetProvider.triggerUpdate(context);
    }

    public static void scheduleNativeAlarm(Context context, AlarmStorage.AlarmItem item) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        Intent intent = new Intent(context, AlarmReceiver.class);
        intent.setAction(ACTION_TRIGGER_ALARM);
        intent.putExtra(EXTRA_ALARM_ID, item.id);

        int requestCode = Math.abs(item.id.hashCode());
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        long triggerAtMillis = item.triggerTimeMs;
        if (triggerAtMillis <= System.currentTimeMillis()) {
            return; // Past alarm
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
        } else {
            alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
        }
    }

    public static void cancelNativeAlarm(Context context, String alarmId) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        Intent intent = new Intent(context, AlarmReceiver.class);
        intent.setAction(ACTION_TRIGGER_ALARM);
        intent.putExtra(EXTRA_ALARM_ID, alarmId);

        int requestCode = Math.abs(alarmId.hashCode());
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        alarmManager.cancel(pendingIntent);
    }
}
