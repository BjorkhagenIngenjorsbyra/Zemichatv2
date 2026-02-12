package com.zemichat.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Broadcast receiver for the "Decline" action on the incoming call notification.
 * Dismisses the notification and finishes IncomingCallActivity if running.
 * The caller's 30-second timeout will handle marking the call as missed.
 */
public class CallDismissReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        // Cancel the notification
        NotificationManager nm =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.cancel(9001); // CALL_NOTIFICATION_ID

        // Tell IncomingCallActivity to finish (if it's open)
        Intent closeIntent = new Intent("com.zemichat.app.DISMISS_CALL");
        context.sendBroadcast(closeIntent);
    }
}
