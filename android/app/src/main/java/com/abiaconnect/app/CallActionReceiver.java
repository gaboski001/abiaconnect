package com.abiaconnect.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Handles the "Decline" action on incoming-call notifications without
 * opening the app: it simply dismisses the ringing notification.
 */
public class CallActionReceiver extends BroadcastReceiver {
    public static final String ACTION_DECLINE_CALL = "com.abiaconnect.app.DECLINE_CALL";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_DECLINE_CALL.equals(intent.getAction())) return;

        int notificationId = intent.getIntExtra("notification_id", -1);
        if (notificationId == -1) return;

        NotificationManager manager =
            (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.cancel(notificationId);
        }
    }
}
