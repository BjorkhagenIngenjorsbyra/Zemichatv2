package com.zemichat.app;

import android.app.ActivityManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Custom Firebase messaging service that intercepts incoming call data messages
 * and shows a full-screen call notification even when the app is in the background or killed.
 *
 * For regular notification+data messages (new_message), Android shows them automatically
 * when the app is in background, so we only handle data-only messages here.
 */
public class ZemichatMessagingService extends FirebaseMessagingService {

    private static final String CHANNEL_ID_CALLS = "incoming_calls";
    private static final int CALL_NOTIFICATION_ID = 9001;

    @Override
    public void onCreate() {
        super.onCreate();
        createCallNotificationChannel();
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        String type = data.get("type");

        if ("incoming_call".equals(type)) {
            // Don't show native notification if app is in foreground —
            // the Realtime subscription will handle it in JS.
            if (!isAppInForeground()) {
                showIncomingCallNotification(data);
            }
        } else if ("call_cancelled".equals(type)) {
            dismissCallNotification();
        }
        // For all other messages (or if app is foregrounded), Capacitor handles them.
        // Note: data-only messages with no 'notification' field don't auto-display,
        // so only our explicit call types need handling here.
    }

    @Override
    public void onNewToken(String token) {
        // Token refresh handled by Capacitor's push-notifications plugin
        // when the app is next opened. Tokens rarely refresh so this is acceptable.
        super.onNewToken(token);
    }

    // ============================================================
    // NOTIFICATION
    // ============================================================

    private void showIncomingCallNotification(Map<String, String> data) {
        String callerName = data.get("callerName");
        String callType = data.get("callType");
        String callLogId = data.get("callLogId");
        String chatId = data.get("chatId");
        String callerId = data.get("callerId");
        String callerAvatar = data.get("callerAvatar");

        if (callerName == null) callerName = "Unknown";
        if (callType == null) callType = "voice";

        // Full-screen intent → IncomingCallActivity
        Intent fullScreenIntent = new Intent(this, IncomingCallActivity.class);
        fullScreenIntent.putExtra("callerName", callerName);
        fullScreenIntent.putExtra("callType", callType);
        fullScreenIntent.putExtra("callLogId", callLogId);
        fullScreenIntent.putExtra("chatId", chatId);
        fullScreenIntent.putExtra("callerId", callerId);
        fullScreenIntent.putExtra("callerAvatar", callerAvatar);
        fullScreenIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                this, 0, fullScreenIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Answer action → opens MainActivity with call data
        Intent answerIntent = new Intent(this, MainActivity.class);
        answerIntent.setAction("ANSWER_CALL");
        answerIntent.putExtra("callLogId", callLogId);
        answerIntent.putExtra("chatId", chatId);
        answerIntent.putExtra("callType", callType);
        answerIntent.putExtra("callerId", callerId);
        answerIntent.putExtra("callerName", callerName);
        answerIntent.putExtra("callerAvatar", callerAvatar);
        answerIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent answerPendingIntent = PendingIntent.getActivity(
                this, 1, answerIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Decline action → just dismiss notification (caller's 30s timeout handles the rest)
        Intent declineIntent = new Intent(this, CallDismissReceiver.class);
        declineIntent.setAction("DECLINE_CALL");
        declineIntent.putExtra("callLogId", callLogId);

        PendingIntent declinePendingIntent = PendingIntent.getBroadcast(
                this, 2, declineIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String callTypeLabel = "video".equals(callType) ? "Video call" : "Voice call";
        String contentText = callTypeLabel + " from " + callerName;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID_CALLS)
                .setSmallIcon(android.R.drawable.sym_call_incoming)
                .setContentTitle(callerName)
                .setContentText(contentText)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setOngoing(true)
                .setAutoCancel(false)
                .setTimeoutAfter(35_000) // Auto-dismiss after 35 seconds
                .setFullScreenIntent(fullScreenPendingIntent, true)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Decline", declinePendingIntent)
                .addAction(android.R.drawable.sym_action_call, "Answer", answerPendingIntent);

        NotificationManager notificationManager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        notificationManager.notify(CALL_NOTIFICATION_ID, builder.build());
    }

    private void dismissCallNotification() {
        NotificationManager notificationManager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        notificationManager.cancel(CALL_NOTIFICATION_ID);
    }

    private void createCallNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID_CALLS,
                    "Incoming Calls",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notifications for incoming voice and video calls");
            channel.setSound(null, null); // IncomingCallActivity handles sound
            channel.enableVibration(false); // IncomingCallActivity handles vibration
            channel.setBypassDnd(true);
            channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
        }
    }

    // ============================================================
    // HELPERS
    // ============================================================

    private boolean isAppInForeground() {
        ActivityManager am = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
        if (am == null) return false;
        for (ActivityManager.RunningAppProcessInfo process : am.getRunningAppProcesses()) {
            if (process.processName.equals(getPackageName())) {
                return process.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND;
            }
        }
        return false;
    }
}
