package com.meditime.app;

import android.app.KeyguardManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.Animation;
import android.view.animation.ScaleAnimation;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Dedicated Native Full-Screen Alarm Activity shown directly over Android Lock Screen.
 */
public class AlarmActivity extends AppCompatActivity {
    private String alarmId;
    private TextView tvCurrentClock;
    private Handler clockHandler;
    private Runnable clockRunnable;
    private boolean actionLocked = false;

    private final BroadcastReceiver closeReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            finish();
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Configure Lock Screen Presentation Flags
        setupLockScreenFlags();

        setContentView(R.layout.activity_alarm);

        alarmId = getIntent().getStringExtra(AlarmService.EXTRA_ALARM_ID);
        String medName = getIntent().getStringExtra(AlarmService.EXTRA_MED_NAME);
        String dosage = getIntent().getStringExtra(AlarmService.EXTRA_DOSAGE);
        String time = getIntent().getStringExtra(AlarmService.EXTRA_TIME);
        String instructions = getIntent().getStringExtra(AlarmService.EXTRA_INSTRUCTIONS);

        TextView tvMedName = findViewById(R.id.tv_medicine_name);
        TextView tvDosageInstruction = findViewById(R.id.tv_dosage_instruction);
        TextView tvScheduledTime = findViewById(R.id.tv_scheduled_time);
        tvCurrentClock = findViewById(R.id.tv_current_clock);
        ImageView ivAlarmIcon = findViewById(R.id.iv_alarm_icon);

        if (medName != null && !medName.isEmpty()) {
            tvMedName.setText(medName);
        }
        
        StringBuilder details = new StringBuilder();
        if (dosage != null && !dosage.isEmpty()) {
            details.append(dosage);
        }
        if (instructions != null && !instructions.isEmpty()) {
            if (details.length() > 0) details.append(" • ");
            details.append(instructions);
        }
        if (details.length() > 0) {
            tvDosageInstruction.setText(details.toString());
        }

        if (time != null && !time.isEmpty()) {
            tvScheduledTime.setText(formatDisplayTime(time));
        }

        // Pulse Animation on Alarm Icon
        ScaleAnimation pulse = new ScaleAnimation(
                1.0f, 1.15f, 1.0f, 1.15f,
                Animation.RELATIVE_TO_SELF, 0.5f,
                Animation.RELATIVE_TO_SELF, 0.5f
        );
        pulse.setDuration(600);
        pulse.setRepeatMode(Animation.REVERSE);
        pulse.setRepeatCount(Animation.INFINITE);
        ivAlarmIcon.startAnimation(pulse);

        // Buttons
        Button btnTaken = findViewById(R.id.btn_taken);
        Button btnSnooze = findViewById(R.id.btn_snooze);
        Button btnStop = findViewById(R.id.btn_stop);
        Button btnSkip = findViewById(R.id.btn_skip);

        btnTaken.setOnClickListener(v -> executeAction(AlarmReceiver.ACTION_ALARM_TAKEN));
        btnSnooze.setOnClickListener(v -> executeAction(AlarmReceiver.ACTION_ALARM_SNOOZE));
        btnStop.setOnClickListener(v -> executeAction(AlarmReceiver.ACTION_ALARM_STOP));
        btnSkip.setOnClickListener(v -> executeAction(AlarmReceiver.ACTION_ALARM_SKIP));

        // Clock updater
        updateCurrentClock();
        clockHandler = new Handler(Looper.getMainLooper());
        clockRunnable = new Runnable() {
            @Override
            public void run() {
                updateCurrentClock();
                clockHandler.postDelayed(this, 1000);
            }
        };
        clockHandler.postDelayed(clockRunnable, 1000);

        // Register close broadcast
        IntentFilter filter = new IntentFilter(AlarmReceiver.ACTION_CLOSE_ALARM_ACTIVITY);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(closeReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(closeReceiver, filter);
        }
    }

    private void setupLockScreenFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) {
                km.requestDismissKeyguard(this, null);
            }
        } else {
            getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                            | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                            | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                            | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            );
        }
    }

    private void executeAction(String broadcastAction) {
        if (actionLocked) return;
        actionLocked = true;

        Intent intent = new Intent(this, AlarmReceiver.class);
        intent.setAction(broadcastAction);
        intent.putExtra(AlarmReceiver.EXTRA_ALARM_ID, alarmId);
        sendBroadcast(intent);

        finish();
    }

    private void updateCurrentClock() {
        SimpleDateFormat sdf = new SimpleDateFormat("hh:mm a", Locale.getDefault());
        tvCurrentClock.setText(sdf.format(new Date()));
    }

    private String formatDisplayTime(String raw) {
        try {
            if (raw.contains("T")) {
                SimpleDateFormat isoFmt = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm", Locale.getDefault());
                Date d = isoFmt.parse(raw.substring(0, Math.min(raw.length(), 16)));
                SimpleDateFormat dispFmt = new SimpleDateFormat("hh:mm a", Locale.getDefault());
                return dispFmt.format(d);
            }
        } catch (Exception ignored) {}
        return raw;
    }

    @Override
    protected void onDestroy() {
        if (clockHandler != null && clockRunnable != null) {
            clockHandler.removeCallbacks(clockRunnable);
        }
        try {
            unregisterReceiver(closeReceiver);
        } catch (Exception ignored) {}
        super.onDestroy();
    }
}
