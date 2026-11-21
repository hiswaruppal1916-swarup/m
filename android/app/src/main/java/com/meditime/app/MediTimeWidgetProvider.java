package com.meditime.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.widget.RemoteViews;
import org.json.JSONObject;

/**
 * Android Home Screen Widget Provider supporting compact (2x1), standard (2x2), and expanded (4x2) layouts.
 */
public class MediTimeWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        AlarmStorage storage = new AlarmStorage(context);
        JSONObject data = storage.getWidgetData();

        for (int appWidgetId : appWidgetIds) {
            Bundle options = appWidgetManager.getAppWidgetOptions(appWidgetId);
            RemoteViews views = createRemoteViews(context, data, options);
            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager appWidgetManager, int appWidgetId, Bundle newOptions) {
        AlarmStorage storage = new AlarmStorage(context);
        JSONObject data = storage.getWidgetData();
        RemoteViews views = createRemoteViews(context, data, newOptions);
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private RemoteViews createRemoteViews(Context context, JSONObject data, Bundle options) {
        int minHeight = 140;
        int minWidth = 140;
        if (options != null) {
            minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 140);
            minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 140);
        }

        // Layout selection based on widget dimensions
        int layoutId;
        if (minHeight < 100) {
            layoutId = R.layout.widget_meditime_2x1;
        } else if (minWidth > 250) {
            layoutId = R.layout.widget_meditime_4x2;
        } else {
            layoutId = R.layout.widget_meditime_2x2;
        }

        RemoteViews views = new RemoteViews(context.getPackageName(), layoutId);

        // Extract values from data
        int total = data.optInt("total", 0);
        int taken = data.optInt("taken", 0);
        int remaining = data.optInt("remaining", 0);
        int missed = data.optInt("missed", 0);
        String dateStr = data.optString("date", "Today");
        String nextName = data.optString("nextMedName", "");
        String nextTime = data.optString("nextMedTime", "");
        String nextDosage = data.optString("nextMedDosage", "");
        String status = data.optString("status", "All reminders active");

        // Format strings
        String progressStr = total > 0 ? "[ " + taken + " / " + total + " Taken ]" : "No Medicines";
        if (nextName.isEmpty()) {
            nextName = total > 0 && remaining == 0 ? "All done for today! 🎉" : "No upcoming doses";
            nextTime = "";
        } else if (!nextDosage.isEmpty()) {
            nextName = nextName + " — " + nextDosage;
        }

        // Bind text to views (safe check in case smaller layouts don't have all IDs)
        try {
            views.setTextViewText(R.id.widget_tv_date, dateStr);
        } catch (Exception ignored) {}

        try {
            views.setTextViewText(R.id.widget_tv_progress_badge, progressStr);
        } catch (Exception ignored) {}

        try {
            views.setTextViewText(R.id.widget_tv_taken_count, String.valueOf(taken));
            views.setTextViewText(R.id.widget_tv_remaining_count, String.valueOf(remaining));
            views.setTextViewText(R.id.widget_tv_missed_count, String.valueOf(missed));
        } catch (Exception ignored) {}

        try {
            views.setTextViewText(R.id.widget_tv_next_name, nextName);
            views.setTextViewText(R.id.widget_tv_next_time, nextTime);
        } catch (Exception ignored) {}

        try {
            views.setTextViewText(R.id.widget_tv_status, status);
        } catch (Exception ignored) {}

        // Tap widget -> Open MediTime MainActivity
        Intent intent = new Intent(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );
        views.setOnClickPendingIntent(R.id.widget_container, pendingIntent);

        return views;
    }

    public static void triggerUpdate(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName component = new ComponentName(context, MediTimeWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(component);
        if (ids != null && ids.length > 0) {
            Intent intent = new Intent(context, MediTimeWidgetProvider.class);
            intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            context.sendBroadcast(intent);
        }
    }
}
