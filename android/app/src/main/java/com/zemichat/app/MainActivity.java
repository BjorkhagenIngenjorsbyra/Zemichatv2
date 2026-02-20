package com.zemichat.app;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register plugins before super.onCreate() — Bridge dispatches initial intent in load()
        registerPlugin(ShareTargetPlugin.class);
        registerPlugin(CallNotificationPlugin.class);
        super.onCreate(savedInstanceState);
        handleCallIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleCallIntent(intent);
    }

    /**
     * When the user taps "Answer" on the heads-up notification (device unlocked),
     * the intent arrives here instead of IncomingCallActivity. Populate the
     * pending call action so the JS layer can detect and auto-answer.
     */
    private void handleCallIntent(Intent intent) {
        if (intent != null && "ANSWER_CALL".equals(intent.getAction())) {
            CallNotificationPlugin.pendingCallAction = new CallNotificationPlugin.CallAction(
                "answer",
                intent.getStringExtra("callLogId"),
                intent.getStringExtra("chatId"),
                intent.getStringExtra("callType"),
                intent.getStringExtra("callerId"),
                intent.getStringExtra("callerName"),
                intent.getStringExtra("callerAvatar")
            );
            // Dismiss the incoming call notification
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            nm.cancel(9001);
        }
    }
}
