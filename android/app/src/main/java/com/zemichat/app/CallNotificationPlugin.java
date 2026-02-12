package com.zemichat.app;

import android.app.NotificationManager;
import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor plugin that bridges native incoming call actions to the JS layer.
 * When the user taps "Answer" on IncomingCallActivity, the call data is stored
 * in a static field. The JS layer polls for it on resume.
 */
@CapacitorPlugin(name = "CallNotification")
public class CallNotificationPlugin extends Plugin {

    /**
     * Static field set by IncomingCallActivity when user taps Answer.
     * The JS layer reads and clears it via getPendingCallAction().
     */
    static CallAction pendingCallAction = null;

    /**
     * Check if there's a pending call action (e.g., user answered from native screen).
     * Returns the call data or null.
     */
    @PluginMethod
    public void getPendingCallAction(PluginCall call) {
        JSObject result = new JSObject();

        if (pendingCallAction != null) {
            CallAction action = pendingCallAction;
            pendingCallAction = null;

            JSObject data = new JSObject();
            data.put("action", action.action);
            data.put("callLogId", action.callLogId);
            data.put("chatId", action.chatId);
            data.put("callType", action.callType);
            data.put("callerId", action.callerId);
            data.put("callerName", action.callerName);
            data.put("callerAvatar", action.callerAvatar);
            result.put("data", data);
        } else {
            result.put("data", JSObject.NULL);
        }

        call.resolve(result);
    }

    /**
     * Dismiss the incoming call notification (e.g., when answered from within the app).
     */
    @PluginMethod
    public void dismissCallNotification(PluginCall call) {
        NotificationManager nm =
                (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        nm.cancel(9001); // CALL_NOTIFICATION_ID
        call.resolve();
    }

    /**
     * Data class for pending call actions.
     */
    static class CallAction {
        final String action;
        final String callLogId;
        final String chatId;
        final String callType;
        final String callerId;
        final String callerName;
        final String callerAvatar;

        CallAction(String action, String callLogId, String chatId,
                   String callType, String callerId, String callerName, String callerAvatar) {
            this.action = action;
            this.callLogId = callLogId;
            this.chatId = chatId;
            this.callType = callType;
            this.callerId = callerId;
            this.callerName = callerName;
            this.callerAvatar = callerAvatar;
        }
    }
}
