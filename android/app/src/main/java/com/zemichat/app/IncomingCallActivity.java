package com.zemichat.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

/**
 * Full-screen incoming call activity shown over other apps and the lock screen.
 * Displays caller info with Answer and Decline buttons, plays ringtone and vibrates.
 */
public class IncomingCallActivity extends AppCompatActivity {

    private static final long AUTO_DISMISS_MS = 35_000;

    private String callLogId;
    private String chatId;
    private String callType;
    private String callerId;
    private String callerName;
    private String callerAvatar;

    private Ringtone ringtone;
    private Vibrator vibrator;
    private Handler handler;
    private Runnable autoDismissRunnable;

    private final BroadcastReceiver dismissReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            stopRinging();
            finish();
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Show over lock screen and turn screen on
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
        );

        // Read intent data
        Intent intent = getIntent();
        callerName = intent.getStringExtra("callerName");
        callType = intent.getStringExtra("callType");
        callLogId = intent.getStringExtra("callLogId");
        chatId = intent.getStringExtra("chatId");
        callerId = intent.getStringExtra("callerId");
        callerAvatar = intent.getStringExtra("callerAvatar");

        if (callerName == null) callerName = "Unknown";
        if (callType == null) callType = "voice";

        // Build UI
        setContentView(buildUI());

        // Start ringing and vibrating
        startRinging();

        // Listen for dismiss broadcast (from decline button or cancel push)
        IntentFilter filter = new IntentFilter("com.zemichat.app.DISMISS_CALL");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(dismissReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(dismissReceiver, filter);
        }

        // Auto-dismiss after 35 seconds
        handler = new Handler(Looper.getMainLooper());
        autoDismissRunnable = () -> {
            stopRinging();
            finish();
        };
        handler.postDelayed(autoDismissRunnable, AUTO_DISMISS_MS);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopRinging();
        try {
            unregisterReceiver(dismissReceiver);
        } catch (IllegalArgumentException ignored) {
            // Not registered
        }
        if (handler != null && autoDismissRunnable != null) {
            handler.removeCallbacks(autoDismissRunnable);
        }
    }

    // ============================================================
    // UI (Programmatic — no XML layout needed)
    // ============================================================

    private View buildUI() {
        // Root layout with gradient background
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(48, 128, 48, 128);

        GradientDrawable gradient = new GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                new int[]{ 0xFF1a73e8, 0xFF121212 }
        );
        root.setBackground(gradient);

        // Avatar circle with initial
        TextView avatarView = new TextView(this);
        avatarView.setWidth(dpToPx(120));
        avatarView.setHeight(dpToPx(120));
        avatarView.setGravity(Gravity.CENTER);
        avatarView.setText(callerName.substring(0, 1).toUpperCase());
        avatarView.setTextSize(48);
        avatarView.setTextColor(Color.parseColor("#1a73e8"));
        avatarView.setTypeface(Typeface.DEFAULT_BOLD);

        GradientDrawable avatarBg = new GradientDrawable();
        avatarBg.setShape(GradientDrawable.OVAL);
        avatarBg.setColor(Color.WHITE);
        avatarView.setBackground(avatarBg);

        LinearLayout.LayoutParams avatarParams = new LinearLayout.LayoutParams(
                dpToPx(120), dpToPx(120)
        );
        avatarParams.gravity = Gravity.CENTER;
        root.addView(avatarView, avatarParams);

        // Spacer
        root.addView(createSpacer(32));

        // Caller name
        TextView nameView = new TextView(this);
        nameView.setText(callerName);
        nameView.setTextSize(28);
        nameView.setTextColor(Color.WHITE);
        nameView.setTypeface(Typeface.DEFAULT_BOLD);
        nameView.setGravity(Gravity.CENTER);
        root.addView(nameView, wrapParams());

        // Spacer
        root.addView(createSpacer(8));

        // Call type label
        String callLabel = "video".equals(callType)
                ? "Incoming video call"
                : "Incoming voice call";
        TextView typeView = new TextView(this);
        typeView.setText(callLabel);
        typeView.setTextSize(16);
        typeView.setTextColor(Color.parseColor("#CCFFFFFF"));
        typeView.setGravity(Gravity.CENTER);
        root.addView(typeView, wrapParams());

        // Large spacer before buttons
        root.addView(createSpacer(96));

        // Button row
        LinearLayout buttonRow = new LinearLayout(this);
        buttonRow.setOrientation(LinearLayout.HORIZONTAL);
        buttonRow.setGravity(Gravity.CENTER);

        // Decline column
        LinearLayout declineCol = createButtonColumn(
                "\u2716", // ✖
                "Decline",
                0xFFEF4444, // Red
                v -> onDecline()
        );

        // Spacer between buttons
        View buttonSpacer = new View(this);
        LinearLayout.LayoutParams spacerParams = new LinearLayout.LayoutParams(dpToPx(80), 0);
        buttonRow.addView(declineCol);
        buttonRow.addView(buttonSpacer, spacerParams);

        // Answer column
        String answerIcon = "video".equals(callType) ? "\uD83D\uDCF9" : "\u260E"; // 📹 or ☎
        LinearLayout answerCol = createButtonColumn(
                answerIcon,
                "Answer",
                0xFF22C55E, // Green
                v -> onAnswer()
        );
        buttonRow.addView(answerCol);

        root.addView(buttonRow, wrapParams());

        return root;
    }

    private LinearLayout createButtonColumn(String icon, String label, int color, View.OnClickListener listener) {
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER);

        // Circle button
        TextView btn = new TextView(this);
        btn.setWidth(dpToPx(64));
        btn.setHeight(dpToPx(64));
        btn.setGravity(Gravity.CENTER);
        btn.setText(icon);
        btn.setTextSize(24);
        btn.setTextColor(Color.WHITE);

        GradientDrawable btnBg = new GradientDrawable();
        btnBg.setShape(GradientDrawable.OVAL);
        btnBg.setColor(color);
        btn.setBackground(btnBg);
        btn.setOnClickListener(listener);

        LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(
                dpToPx(64), dpToPx(64)
        );
        btnParams.gravity = Gravity.CENTER;
        col.addView(btn, btnParams);

        // Label
        col.addView(createSpacer(8));
        TextView labelView = new TextView(this);
        labelView.setText(label);
        labelView.setTextSize(14);
        labelView.setTextColor(Color.parseColor("#CCFFFFFF"));
        labelView.setGravity(Gravity.CENTER);
        col.addView(labelView, wrapParams());

        return col;
    }

    // ============================================================
    // ACTIONS
    // ============================================================

    private void onAnswer() {
        stopRinging();
        dismissNotification();

        // Store call data for the Capacitor plugin to pick up
        CallNotificationPlugin.pendingCallAction = new CallNotificationPlugin.CallAction(
                "answer", callLogId, chatId, callType, callerId, callerName, callerAvatar
        );

        // Launch main app
        Intent mainIntent = new Intent(this, MainActivity.class);
        mainIntent.setAction("ANSWER_CALL");
        mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(mainIntent);
        finish();
    }

    private void onDecline() {
        stopRinging();
        dismissNotification();
        finish();
        // Caller's 30s timeout will mark as missed. This is acceptable for v1.
    }

    // ============================================================
    // RINGING & VIBRATION
    // ============================================================

    private void startRinging() {
        // Play default ringtone
        try {
            Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            ringtone = RingtoneManager.getRingtone(getApplicationContext(), ringtoneUri);
            if (ringtone != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    ringtone.setLooping(true);
                }
                AudioAttributes attrs = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
                ringtone.setAudioAttributes(attrs);
                ringtone.play();
            }
        } catch (Exception e) {
            // Silently fail — notification is still visible
        }

        // Vibrate
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                vibrator = vm.getDefaultVibrator();
            } else {
                vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            }

            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = {0, 1000, 500, 1000, 500}; // vibrate 1s, pause 0.5s, repeat
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    vibrator.vibrate(pattern, 0);
                }
            }
        } catch (Exception e) {
            // Silently fail
        }
    }

    private void stopRinging() {
        if (ringtone != null && ringtone.isPlaying()) {
            ringtone.stop();
            ringtone = null;
        }
        if (vibrator != null) {
            vibrator.cancel();
            vibrator = null;
        }
    }

    private void dismissNotification() {
        NotificationManager nm =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        nm.cancel(9001); // CALL_NOTIFICATION_ID
    }

    // ============================================================
    // HELPERS
    // ============================================================

    private int dpToPx(int dp) {
        return (int) (dp * getResources().getDisplayMetrics().density + 0.5f);
    }

    private View createSpacer(int heightDp) {
        View v = new View(this);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dpToPx(heightDp)
        );
        v.setLayoutParams(p);
        return v;
    }

    private LinearLayout.LayoutParams wrapParams() {
        return new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
    }
}
