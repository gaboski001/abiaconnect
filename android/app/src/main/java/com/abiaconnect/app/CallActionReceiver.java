package com.abiaconnect.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Handles Decline (on incoming ringing notification) and Hang-up (on the
 * ongoing call foreground-service notification) without opening the app.
 */
public class CallActionReceiver extends BroadcastReceiver {
    public static final String ACTION_DECLINE_CALL = "com.abiaconnect.app.DECLINE_CALL";
    public static final String ACTION_HANGUP_CALL = "com.abiaconnect.app.HANGUP_CALL";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        String action = intent.getAction();
        String callId = intent.getStringExtra("call_id");

        if (ACTION_DECLINE_CALL.equals(action)) {
            int notificationId = intent.getIntExtra("notification_id", -1);
            if (notificationId != -1) {
                NotificationManager manager =
                    (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (manager != null) manager.cancel(notificationId);
            }
            // If a foreground call service somehow got started for this call, stop it too.
            CallForegroundService.stop(context);

            // Tell the web layer to reject the call on the server (send hangup signal).
            Intent broadcast = new Intent("com.abiaconnect.app.CALL_DECLINE");
            broadcast.setPackage(context.getPackageName());
            broadcast.putExtra("call_id", callId);
            context.sendBroadcast(broadcast);
            return;
        }

        if (ACTION_HANGUP_CALL.equals(action)) {
            CallForegroundService.stop(context);
            Intent broadcast = new Intent("com.abiaconnect.app.CALL_HANGUP");
            broadcast.setPackage(context.getPackageName());
            broadcast.putExtra("call_id", callId);
            context.sendBroadcast(broadcast);
        }
    }
}
