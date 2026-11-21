package com.meditime.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import java.util.List;

/**
 * Reschedules all valid native alarms and restores widgets upon device restart or package update.
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();

        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
                || "android.intent.action.QUICKBOOT_POWERON".equals(action)
                || "com.htc.intent.action.QUICKBOOT_POWERON".equals(action)) {

            AlarmStorage storage = new AlarmStorage(context);
            List<AlarmStorage.AlarmItem> alarms = storage.getAllAlarms();
            long now = System.currentTimeMillis();

            for (AlarmStorage.AlarmItem item : alarms) {
                if (item.triggerTimeMs > now) {
                    AlarmReceiver.scheduleNativeAlarm(context, item);
                } else {
                    // Clean up past alarms
                    storage.removeAlarm(item.id);
                }
            }

            // Update Home Screen Widget
            MediTimeWidgetProvider.triggerUpdate(context);
        }
    }
}
