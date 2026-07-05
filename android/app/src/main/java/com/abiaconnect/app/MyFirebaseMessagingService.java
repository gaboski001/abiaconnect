package com.abiaconnect.app;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.text.TextUtils;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class MyFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "AbiaConnectFCM";

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "New token: " + token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        String title = value(remoteMessage, "title", "New notification");
        String body = value(remoteMessage, "body", value(remoteMessage, "message", ""));
        String type = value(remoteMessage, "type", "general");
        String callId = value(remoteMessage, "callId", "");
        String conversationId = value(remoteMessage, "conversationId", "");
        String url = value(remoteMessage, "url", TextUtils.isEmpty(conversationId) ? "/notifications" : "/messages/" + conversationId);

        if ("call".equals(type)) {
            showIncomingCallNotification(title, body, callId, url);
        } else {
            showStandardNotification(title, body, type, url, callId);
        }
    }

    private String value(RemoteMessage remoteMessage, String key, String fallback) {
        String dataValue = remoteMessage.getData().get(key);
        if (!TextUtils.isEmpty(dataValue)) return dataValue;
        if (remoteMessage.getNotification() != null) {
            if ("title".equals(key) && !TextUtils.isEmpty(remoteMessage.getNotification().getTitle())) {
                return remoteMessage.getNotification().getTitle();
            }
            if (("body".equals(key) || "message".equals(key)) && !TextUtils.isEmpty(remoteMessage.getNotification().getBody())) {
                return remoteMessage.getNotification().getBody();
            }
        }
        return fallback;
    }

    private PendingIntent buildContentIntent(int requestCode, String type, String url, String callId) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("notification_type", type);
        intent.putExtra("url", url);
        intent.putExtra("call_id", callId);
        return PendingIntent.getActivity(
            this,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private void showStandardNotification(String title, String body, String type, String url, String callId) {
        int notificationId = (int) System.currentTimeMillis();
        PendingIntent contentIntent = buildContentIntent(notificationId, type, url, callId);
        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, BaseActivity.CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_abiaconnect)
            .setColor(ContextCompat.getColor(this, R.color.notification_color))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setSound(sound)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(contentIntent)
            .setVibrate(new long[]{0, 300, 180, 300});

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(notificationId, builder.build());
        }
    }

    private void showIncomingCallNotification(String title, String body, String callId, String url) {
        int notificationId = TextUtils.isEmpty(callId) ? (int) System.currentTimeMillis() : callId.hashCode();
        PendingIntent fullScreenIntent = buildContentIntent(notificationId, "call", url, callId);
        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, BaseActivity.CALL_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_abiaconnect)
            .setColor(ContextCompat.getColor(this, R.color.notification_color))
            .setContentTitle(TextUtils.isEmpty(title) ? "Incoming call" : title)
            .setContentText(TextUtils.isEmpty(body) ? "Open AbiaConnect to answer" : body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(TextUtils.isEmpty(body) ? "Open AbiaConnect to answer" : body))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setSound(sound)
            .setVibrate(new long[]{0, 700, 350, 700, 350, 700})
            .setContentIntent(fullScreenIntent)
            .setFullScreenIntent(fullScreenIntent, true)
            .setTimeoutAfter(45000)
            .addAction(0, "Open", fullScreenIntent);

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(notificationId, builder.build());
        }
    }
}
