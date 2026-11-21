package com.meditime.app;

import android.app.AlarmManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "MediTimeNative")
public class MediTimeNativePlugin extends Plugin {

    @PluginMethod
    public void checkDevicePermissions(PluginCall call) {
        Context context = getContext();
        JSObject ret = new JSObject();

        // 1. Notification Permission
        boolean notifGranted = NotificationManagerCompat.from(context).areNotificationsEnabled();
        ret.put("notificationsGranted", notifGranted);

        // 2. Exact Alarm Permission (Android 12+)
        boolean exactAlarmGranted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            exactAlarmGranted = (am != null && am.canScheduleExactAlarms());
        }
        ret.put("exactAlarmGranted", exactAlarmGranted);

        // 3. Battery Optimization Exemption
        boolean batteryIgnored = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                batteryIgnored = pm.isIgnoringBatteryOptimizations(context.getPackageName());
            }
        }
        ret.put("batteryOptimizationIgnored", batteryIgnored);

        // 4. Full screen / Overlay capability
        boolean canDrawOverlays = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            canDrawOverlays = Settings.canDrawOverlays(context);
        }
        ret.put("canDrawOverlays", canDrawOverlays);

        ret.put("isNative", true);
        ret.put("manufacturer", Build.MANUFACTURER);
        ret.put("brand", Build.BRAND);
        ret.put("model", Build.MODEL);
        ret.put("androidSdk", Build.VERSION.SDK_INT);

        call.resolve(ret);
    }

    @PluginMethod
    public void requestExactAlarmPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                call.resolve();
            } catch (Exception e) {
                call.reject("Could not open exact alarm settings: " + e.getMessage());
            }
        } else {
            call.resolve();
        }
    }

    @PluginMethod
    public void requestBatteryOptimizationExemption(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                call.resolve();
            } catch (Exception e) {
                try {
                    // Fallback to battery optimization settings list
                    Intent fallback = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                    fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(fallback);
                    call.resolve();
                } catch (Exception ex) {
                    call.reject("Could not open battery settings: " + ex.getMessage());
                }
            }
        } else {
            call.resolve();
        }
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        try {
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            } else {
                intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open notification settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openManufacturerSettings(PluginCall call) {
        String mfg = Build.MANUFACTURER.toLowerCase();
        Intent intent = new Intent();
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        try {
            if (mfg.contains("xiaomi") || mfg.contains("redmi")) {
                intent.setComponent(new android.content.ComponentName(
                        "com.miui.securitycenter",
                        "com.miui.permcenter.autostart.AutoStartManagementActivity"
                ));
            } else if (mfg.contains("samsung")) {
                intent.setComponent(new android.content.ComponentName(
                        "com.samsung.android.lool",
                        "com.samsung.android.sm.battery.ui.BatteryActivity"
                ));
            } else if (mfg.contains("oppo") || mfg.contains("realme")) {
                intent.setComponent(new android.content.ComponentName(
                        "com.coloros.safecenter",
                        "com.coloros.safecenter.permission.startup.StartupAppListActivity"
                ));
            } else if (mfg.contains("vivo")) {
                intent.setComponent(new android.content.ComponentName(
                        "com.iqoo.secure",
                        "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"
                ));
            } else if (mfg.contains("oneplus")) {
                intent.setComponent(new android.content.ComponentName(
                        "com.oneplus.security",
                        "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity"
                ));
            } else {
                intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            }
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            // General application details fallback
            try {
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                fallback.setData(Uri.parse("package:" + getContext().getPackageName()));
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallback);
                call.resolve();
            } catch (Exception ex) {
                call.reject("Could not open device settings: " + ex.getMessage());
            }
        }
    }

    @PluginMethod
    public void scheduleNativeAlarm(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            call.reject("id is required");
            return;
        }

        AlarmStorage.AlarmItem item = new AlarmStorage.AlarmItem();
        item.id = id;
        item.medicineName = call.getString("medicineName", "Medicine");
        item.dosage = call.getString("dosage", "");
        item.scheduledTime = call.getString("scheduledTime", "");
        item.instructions = call.getString("instructions", "");
        item.soundTone = call.getString("soundTone", "classic_repeating_alarm");
        item.triggerType = call.getString("triggerType", "fixed");

        Long triggerMs = call.getLong("triggerTimeMs");
        if (triggerMs == null || triggerMs <= 0) {
            call.reject("valid triggerTimeMs is required");
            return;
        }
        item.triggerTimeMs = triggerMs;

        AlarmStorage storage = new AlarmStorage(getContext());
        storage.saveAlarm(item);
        AlarmReceiver.scheduleNativeAlarm(getContext(), item);

        call.resolve();
    }

    @PluginMethod
    public void cancelNativeAlarm(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            call.reject("id is required");
            return;
        }

        AlarmStorage storage = new AlarmStorage(getContext());
        storage.removeAlarm(id);
        AlarmReceiver.cancelNativeAlarm(getContext(), id);

        call.resolve();
    }

    @PluginMethod
    public void cancelAllNativeAlarms(PluginCall call) {
        AlarmStorage storage = new AlarmStorage(getContext());
        for (AlarmStorage.AlarmItem item : storage.getAllAlarms()) {
            AlarmReceiver.cancelNativeAlarm(getContext(), item.id);
        }
        storage.clearAllAlarms();
        call.resolve();
    }

    @PluginMethod
    public void updateWidgetData(PluginCall call) {
        try {
            JSONObject data = new JSONObject();
            data.put("total", call.getInt("total", 0));
            data.put("taken", call.getInt("taken", 0));
            data.put("remaining", call.getInt("remaining", 0));
            data.put("missed", call.getInt("missed", 0));
            data.put("date", call.getString("date", "Today"));
            data.put("nextMedName", call.getString("nextMedName", ""));
            data.put("nextMedTime", call.getString("nextMedTime", ""));
            data.put("nextMedDosage", call.getString("nextMedDosage", ""));
            data.put("status", call.getString("status", "All reminders active"));

            AlarmStorage storage = new AlarmStorage(getContext());
            storage.saveWidgetData(data);
            MediTimeWidgetProvider.triggerUpdate(getContext());

            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to update widget: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getPendingNativeActions(PluginCall call) {
        AlarmStorage storage = new AlarmStorage(getContext());
        JSONArray actions = storage.getPendingActions();
        try {
            JSArray jsArray = new JSArray();
            for (int i = 0; i < actions.length(); i++) {
                JSONObject obj = actions.getJSONObject(i);
                JSObject item = new JSObject();
                item.put("action", obj.optString("action"));
                item.put("alarmId", obj.optString("alarmId"));
                item.put("timestamp", obj.optLong("timestamp"));
                jsArray.put(item);
            }
            JSObject ret = new JSObject();
            ret.put("actions", jsArray);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed reading pending actions: " + e.getMessage());
        }
    }

    @PluginMethod
    public void clearPendingNativeActions(PluginCall call) {
        AlarmStorage storage = new AlarmStorage(getContext());
        storage.clearPendingActions();
        call.resolve();
    }

    @PluginMethod
    public void triggerTestAlarm(PluginCall call) {
        AlarmStorage.AlarmItem item = new AlarmStorage.AlarmItem();
        item.id = "test_alarm_" + System.currentTimeMillis();
        item.medicineName = call.getString("medicineName", "Pantoprazole 40mg");
        item.dosage = call.getString("dosage", "40mg");
        item.scheduledTime = new java.text.SimpleDateFormat("hh:mm a", java.util.Locale.getDefault()).format(new java.util.Date());
        item.instructions = "Test Alarm Notification";
        item.triggerTimeMs = System.currentTimeMillis() + 2000; // 2 seconds

        AlarmStorage storage = new AlarmStorage(getContext());
        storage.saveAlarm(item);
        AlarmReceiver.scheduleNativeAlarm(getContext(), item);

        call.resolve();
    }
}
