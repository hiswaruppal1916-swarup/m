package com.meditime.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.Vibrator;
import androidx.core.app.NotificationCompat;

/**
 * Foreground Service for robust, sustained audio/vibration alarm playback
 * and persistent high-priority notification with lock-screen action buttons.
 */
public class AlarmService extends Service {
    public static final String CHANNEL_ID = "meditime_native_alarm_channel";
    public static final int NOTIFICATION_ID = 1001;
    public static final String EXTRA_ALARM_ID = "extra_alarm_id";
    public static final String EXTRA_MED_NAME = "extra_med_name";
    public static final String EXTRA_DOSAGE = "extra_dosage";
    public static final String EXTRA_TIME = "extra_time";
    public static final String EXTRA_INSTRUCTIONS = "extra_instructions";

    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;
    private Handler timeoutHandler;
    private Runnable timeoutRunnable;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String action = intent.getAction();
        if ("ACTION_STOP_ALARM".equals(action)) {
            stopAlarmPlayback();
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        String alarmId = intent.getStringExtra(EXTRA_ALARM_ID);
        String medName = intent.getStringExtra(EXTRA_MED_NAME);
        String dosage = intent.getStringExtra(EXTRA_DOSAGE);
        String time = intent.getStringExtra(EXTRA_TIME);
        String instructions = intent.getStringExtra(EXTRA_INSTRUCTIONS);

        if (medName == null) medName = "Medicine Reminder";
        if (dosage == null) dosage = "";
        if (time == null) time = "";

        // Build Full Screen Intent to AlarmActivity
        Intent fullScreenIntent = new Intent(this, AlarmActivity.class);
        fullScreenIntent.putExtra(EXTRA_ALARM_ID, alarmId);
        fullScreenIntent.putExtra(EXTRA_MED_NAME, medName);
        fullScreenIntent.putExtra(EXTRA_DOSAGE, dosage);
        fullScreenIntent.putExtra(EXTRA_TIME, time);
        fullScreenIntent.putExtra(EXTRA_INSTRUCTIONS, instructions);
        fullScreenIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                this,
                0,
                fullScreenIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        // Action: TAKEN
        Intent takenIntent = new Intent(this, AlarmReceiver.class);
        takenIntent.setAction(AlarmReceiver.ACTION_ALARM_TAKEN);
        takenIntent.putExtra(EXTRA_ALARM_ID, alarmId);
        PendingIntent takenPendingIntent = PendingIntent.getBroadcast(
                this,
                1,
                takenIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        // Action: SNOOZE
        Intent snoozeIntent = new Intent(this, AlarmReceiver.class);
        snoozeIntent.setAction(AlarmReceiver.ACTION_ALARM_SNOOZE);
        snoozeIntent.putExtra(EXTRA_ALARM_ID, alarmId);
        PendingIntent snoozePendingIntent = PendingIntent.getBroadcast(
                this,
                2,
                snoozeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        // Content intent (tap notification) -> Open AlarmActivity or MainActivity
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_launcher_foreground)
                .setContentTitle(getString(R.string.notification_title_due))
                .setContentText(medName + " (" + dosage + ") • " + time)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(false)
                .setContentIntent(fullScreenPendingIntent)
                .setFullScreenIntent(fullScreenPendingIntent, true)
                .addAction(R.drawable.ic_med_pill, getString(R.string.action_taken), takenPendingIntent)
                .addAction(R.drawable.ic_alarm_bell, getString(R.string.action_snooze), snoozePendingIntent);

        Notification notification = builder.build();
        startForeground(NOTIFICATION_ID, notification);

        // Start loud audio and vibration
        startAlarmAudioAndVibration();

        // 10-minute safety timeout to prevent permanent ringing if device unattended
        timeoutHandler = new Handler(Looper.getMainLooper());
        timeoutRunnable = () -> {
            stopAlarmPlayback();
            stopForeground(true);
            stopSelf();
        };
        timeoutHandler.postDelayed(timeoutRunnable, 10 * 60 * 1000);

        return START_STICKY;
    }

    private void startAlarmAudioAndVibration() {
        try {
            Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }

            mediaPlayer = new MediaPlayer();
            mediaPlayer.setDataSource(this, alarmUri);
            mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
            mediaPlayer.setAudioStreamType(AudioManager.STREAM_ALARM);
            mediaPlayer.setLooping(true);
            mediaPlayer.prepare();
            mediaPlayer.start();
        } catch (Exception e) {
            e.printStackTrace();
        }

        try {
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = {0, 800, 400, 800, 400};
                vibrator.vibrate(pattern, 0); // 0 = repeat indefinitely
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void stopAlarmPlayback() {
        if (timeoutHandler != null && timeoutRunnable != null) {
            timeoutHandler.removeCallbacks(timeoutRunnable);
        }
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
            } catch (Exception ignored) {}
            mediaPlayer = null;
        }
        if (vibrator != null) {
            try {
                vibrator.cancel();
            } catch (Exception ignored) {}
            vibrator = null;
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        getString(R.string.alarm_channel_name),
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription(getString(R.string.alarm_channel_description));
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                channel.enableVibration(true);
                channel.setBypassDnd(true);
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .build();
                channel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM), audioAttributes);
                nm.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onDestroy() {
        stopAlarmPlayback();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    public static void startAlarm(Context context, AlarmStorage.AlarmItem item) {
        Intent intent = new Intent(context, AlarmService.class);
        intent.putExtra(EXTRA_ALARM_ID, item.id);
        intent.putExtra(EXTRA_MED_NAME, item.medicineName);
        intent.putExtra(EXTRA_DOSAGE, item.dosage);
        intent.putExtra(EXTRA_TIME, item.scheduledTime);
        intent.putExtra(EXTRA_INSTRUCTIONS, item.instructions);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    public static void stopAlarm(Context context) {
        Intent intent = new Intent(context, AlarmService.class);
        intent.setAction("ACTION_STOP_ALARM");
        context.startService(intent);
    }
}
