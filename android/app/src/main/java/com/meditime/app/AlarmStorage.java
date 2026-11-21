package com.meditime.app;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Thread-safe persistent local storage for native alarms, widget state, and action synchronization queue.
 */
public class AlarmStorage {
    private static final String PREF_NAME = "meditime_native_storage";
    private static final String KEY_PREFIX_ALARM = "alarm_";
    private static final String KEY_WIDGET_DATA = "widget_data";
    private static final String KEY_PENDING_ACTIONS = "pending_actions";
    private static final String KEY_ACTIVE_RINGING = "active_ringing_alarm";

    private final SharedPreferences prefs;

    public AlarmStorage(Context context) {
        this.prefs = context.getApplicationContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    }

    public static class AlarmItem {
        public String id;
        public String medicineName;
        public String dosage;
        public String scheduledTime; // ISO 8601
        public long triggerTimeMs;
        public String triggerType;
        public String soundTone;
        public String instructions;

        public JSONObject toJson() throws JSONException {
            JSONObject obj = new JSONObject();
            obj.put("id", id);
            obj.put("medicineName", medicineName);
            obj.put("dosage", dosage);
            obj.put("scheduledTime", scheduledTime);
            obj.put("triggerTimeMs", triggerTimeMs);
            obj.put("triggerType", triggerType);
            obj.put("soundTone", soundTone);
            obj.put("instructions", instructions);
            return obj;
        }

        public static AlarmItem fromJson(JSONObject obj) {
            AlarmItem item = new AlarmItem();
            item.id = obj.optString("id");
            item.medicineName = obj.optString("medicineName");
            item.dosage = obj.optString("dosage");
            item.scheduledTime = obj.optString("scheduledTime");
            item.triggerTimeMs = obj.optLong("triggerTimeMs");
            item.triggerType = obj.optString("triggerType");
            item.soundTone = obj.optString("soundTone");
            item.instructions = obj.optString("instructions");
            return item;
        }
    }

    public synchronized void saveAlarm(AlarmItem item) {
        try {
            prefs.edit().putString(KEY_PREFIX_ALARM + item.id, item.toJson().toString()).apply();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public synchronized void removeAlarm(String id) {
        prefs.edit().remove(KEY_PREFIX_ALARM + id).apply();
    }

    public synchronized void clearAllAlarms() {
        SharedPreferences.Editor editor = prefs.edit();
        Map<String, ?> all = prefs.getAll();
        for (String key : all.keySet()) {
            if (key.startsWith(KEY_PREFIX_ALARM)) {
                editor.remove(key);
            }
        }
        editor.apply();
    }

    public synchronized List<AlarmItem> getAllAlarms() {
        List<AlarmItem> list = new ArrayList<>();
        Map<String, ?> all = prefs.getAll();
        for (Map.Entry<String, ?> entry : all.entrySet()) {
            if (entry.getKey().startsWith(KEY_PREFIX_ALARM)) {
                try {
                    String jsonStr = (String) entry.getValue();
                    list.add(AlarmItem.fromJson(new JSONObject(jsonStr)));
                } catch (Exception ignored) {}
            }
        }
        return list;
    }

    public synchronized AlarmItem getAlarm(String id) {
        String json = prefs.getString(KEY_PREFIX_ALARM + id, null);
        if (json == null) return null;
        try {
            return AlarmItem.fromJson(new JSONObject(json));
        } catch (Exception e) {
            return null;
        }
    }

    // Active Ringing Alarm State
    public synchronized void setActiveRingingAlarm(AlarmItem item) {
        if (item == null) {
            prefs.edit().remove(KEY_ACTIVE_RINGING).apply();
        } else {
            try {
                prefs.edit().putString(KEY_ACTIVE_RINGING, item.toJson().toString()).apply();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    public synchronized AlarmItem getActiveRingingAlarm() {
        String json = prefs.getString(KEY_ACTIVE_RINGING, null);
        if (json == null) return null;
        try {
            return AlarmItem.fromJson(new JSONObject(json));
        } catch (Exception e) {
            return null;
        }
    }

    // Widget Data
    public synchronized void saveWidgetData(JSONObject data) {
        prefs.edit().putString(KEY_WIDGET_DATA, data.toString()).apply();
    }

    public synchronized JSONObject getWidgetData() {
        String json = prefs.getString(KEY_WIDGET_DATA, null);
        if (json == null) return new JSONObject();
        try {
            return new JSONObject(json);
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    // Action Synchronization Queue
    public synchronized void enqueueAction(String action, String alarmId, long timestamp) {
        try {
            JSONArray arr = getPendingActions();
            JSONObject item = new JSONObject();
            item.put("action", action);
            item.put("alarmId", alarmId);
            item.put("timestamp", timestamp);
            arr.put(item);
            prefs.edit().putString(KEY_PENDING_ACTIONS, arr.toString()).apply();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public synchronized JSONArray getPendingActions() {
        String json = prefs.getString(KEY_PENDING_ACTIONS, null);
        if (json == null) return new JSONArray();
        try {
            return new JSONArray(json);
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    public synchronized void clearPendingActions() {
        prefs.edit().remove(KEY_PENDING_ACTIONS).apply();
    }
}
