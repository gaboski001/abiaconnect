package com.abiaconnect.app;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.text.TextUtils;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.drawable.IconCompat;

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
        String defaultUrl;
        if ("call".equals(type)) {
            defaultUrl = TextUtils.isEmpty(callId) ? "/call" : "/call/" + callId;
        } else {
            defaultUrl = TextUtils.isEmpty(conversationId) ? "/notifications" : "/messages/" + conversationId;
        }
        String url = value(remoteMessage, "url", defaultUrl);

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

    private PendingIntent buildContentIntent(int requestCode, String type, String url, String callId, int notificationId) {
        Intent intent = new Intent(this, MainActivity.class);
        // NOTE: never add FLAG_ACTIVITY_CLEAR_TOP here — with launchMode="singleTask"
        // it destroys and recreates the activity (and the WebView), which kills an
        // in-progress call the moment the user taps Answer.
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("notification_type", type);
        intent.putExtra("url", url);
        intent.putExtra("call_id", callId);
        intent.putExtra("notification_id", notificationId);
        return PendingIntent.getActivity(
            this,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private PendingIntent buildDeclineIntent(int requestCode, String callId, int notificationId) {
        Intent intent = new Intent(this, CallActionReceiver.class);
        intent.setAction(CallActionReceiver.ACTION_DECLINE_CALL);
        intent.putExtra("call_id", callId);
        intent.putExtra("notification_id", notificationId);
        return PendingIntent.getBroadcast(
            this,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private void showStandardNotification(String title, String body, String type, String url, String callId) {
        int notificationId = (int) System.currentTimeMillis();
        PendingIntent contentIntent = buildContentIntent(notificationId, type, url, callId, notificationId);
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
        PendingIntent answerIntent = buildContentIntent(notificationId + 1, "call", url, callId, notificationId);
        PendingIntent declineIntent = buildDeclineIntent(notificationId + 2, callId, notificationId);
        PendingIntent fullScreenIntent = buildContentIntent(notificationId, "call", url, callId, notificationId);
        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);

        String callerName = TextUtils.isEmpty(title) ? "Incoming call" : title;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, BaseActivity.CALL_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_abiaconnect)
            .setColor(ContextCompat.getColor(this, R.color.notification_color))
            .setColorized(true)
            .setContentTitle(callerName)
            .setContentText(TextUtils.isEmpty(body) ? "Incoming AbiaConnect call" : body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(fullScreenIntent)
            .setFullScreenIntent(fullScreenIntent, true)
            .setTimeoutAfter(45000);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // WhatsApp-style incoming call surface: big Answer/Decline buttons,
            // caller identity, and full-screen presentation on the lockscreen.
            Person caller = new Person.Builder()
                .setName(callerName)
                .setIcon(IconCompat.createWithResource(this, R.drawable.ic_stat_abiaconnect))
                .setImportant(true)
                .build();
            builder.setStyle(
                NotificationCompat.CallStyle.forIncomingCall(caller, declineIntent, answerIntent)
            );
        } else {
            builder
                .setStyle(new NotificationCompat.BigTextStyle().bigText(
                    TextUtils.isEmpty(body) ? "Tap to answer" : body))
                .setSound(sound)
                .setVibrate(new long[]{0, 700, 350, 700, 350, 700})
                .addAction(R.drawable.ic_stat_abiaconnect, "Decline", declineIntent)
                .addAction(R.drawable.ic_stat_abiaconnect, "Answer", answerIntent);
        }

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(notificationId, builder.build());
        }
    }
}
