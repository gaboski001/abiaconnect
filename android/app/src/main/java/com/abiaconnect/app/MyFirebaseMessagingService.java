package com.abiaconnect.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
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
        // Don't log the token itself — it's a credential for pushing to this device.
        Log.d(TAG, "FCM token refreshed");
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

        if ("call_cancel".equals(type)) {
            // The caller hung up before it was answered: stop ringing.
            cancelIncomingCall(callId);
            return;
        }
        if ("call".equals(type)) {
            String callerName = value(remoteMessage, "callerName", "");
            boolean video = "video".equals(value(remoteMessage, "callType", "voice"));
            String photo = value(remoteMessage, "callerAvatar", "");
            showIncomingCallNotification(callerName, video, photo, callId, url);
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

    private PendingIntent buildContentIntent(int requestCode, String type, String url, String callId, String callerName, int notificationId, String action) {
        Intent intent = new Intent(this, MainActivity.class);
        // NOTE: never add FLAG_ACTIVITY_CLEAR_TOP here — with launchMode="singleTask"
        // it destroys and recreates the activity (and the WebView), which kills an
        // in-progress call the moment the user taps Answer.
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("notification_type", type);
        intent.putExtra("url", url);
        intent.putExtra("call_id", callId);
        intent.putExtra("caller_name", callerName);
        intent.putExtra("notification_id", notificationId);
        intent.putExtra("call_action", action); // "answer" | "open" | ""
        NotificationIntentGuard.sign(this, intent);
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
        PendingIntent contentIntent = buildContentIntent(notificationId, type, url, callId, null, notificationId, "open");
        // AbiaConnect's own tune (older Android versions use this; newer ones take it from the channel).
        Uri sound = Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.abia_chime);

        BaseActivity.createNotificationChannels(this);
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

    /** The incoming-call alert currently ringing, if any. */
    private static volatile int ringingNotificationId = 0;

    static void stopRinging(Context ctx) {
        int id = ringingNotificationId;
        if (id == 0) return;
        ringingNotificationId = 0;
        NotificationManager manager = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.cancel(id);
    }

    static int incomingCallNotificationId(String callId) {
        return TextUtils.isEmpty(callId) ? 0 : callId.hashCode();
    }

    private void cancelIncomingCall(String callId) {
        if (TextUtils.isEmpty(callId)) return;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.cancel(incomingCallNotificationId(callId));
    }

    /** Light the screen up for a call even when the phone is asleep, like a normal phone call. */
    private void wakeScreen() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm == null || pm.isInteractive()) return;
            @SuppressWarnings("deprecation")
            PowerManager.WakeLock wl = pm.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "AbiaConnect:IncomingCall");
            wl.acquire(10_000L);
        } catch (Exception ignored) {
            // Some phones refuse; the full-screen call alert still shows.
        }
    }

    /** Calls already alerted, so a repeated alert for the same call never rings twice. */
    private static final java.util.Map<String, Long> alertedCalls = new java.util.HashMap<>();

    private static synchronized boolean firstAlertFor(String callId) {
        if (TextUtils.isEmpty(callId)) return true;
        long now = System.currentTimeMillis();
        java.util.Iterator<java.util.Map.Entry<String, Long>> it = alertedCalls.entrySet().iterator();
        while (it.hasNext()) if (now - it.next().getValue() > 120_000L) it.remove();
        if (alertedCalls.containsKey(callId)) return false;
        alertedCalls.put(callId, now);
        return true;
    }

    private void showIncomingCallNotification(String callerNameIn, boolean video, String photoUrl, String callId, String url) {
        // If the app is currently in the foreground, do NOT post the loud
        // system CallStyle notification — the in-app CallOverlay + WebRTC
        // realtime signaling will show and ring the incoming call. This
        // prevents the double-ring shown in the bug report (heads-up call
        // banner ringing at the same time as the in-app UI).
        if (BaseActivity.isAppInForeground()) {
            android.util.Log.d(TAG, "Skipping system call notification — app is in foreground");
            return;
        }
        if (!firstAlertFor(callId)) {
            android.util.Log.d(TAG, "Already alerted for this call");
            return;
        }

        int notificationId = TextUtils.isEmpty(callId) ? (int) System.currentTimeMillis() : incomingCallNotificationId(callId);
        String callerName = TextUtils.isEmpty(callerNameIn) ? "AbiaConnect member" : callerNameIn;
        String body = video ? "Incoming video call" : "Incoming voice call";
        android.graphics.Bitmap picture = CallAvatar.forCaller(this, callerName, photoUrl);
        PendingIntent answerIntent = buildContentIntent(notificationId + 1, "call", url, callId, callerName, notificationId, "answer");
        PendingIntent declineIntent = buildDeclineIntent(notificationId + 2, callId, notificationId);
        // Tapping the notification body (full-screen intent) opens the incoming-call UI
        // but does NOT auto-accept — user must still press Answer.
        PendingIntent fullScreenIntent = buildContentIntent(notificationId, "call", url, callId, callerName, notificationId, "open");
        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);

        BaseActivity.createNotificationChannels(this);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, BaseActivity.CALL_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_call)
            .setLargeIcon(picture)
            .setColor(ContextCompat.getColor(this, R.color.notification_color))
            .setColorized(true)
            .setContentTitle(callerName)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(fullScreenIntent)
            .setFullScreenIntent(fullScreenIntent, true)
            .setTimeoutAfter(40000);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // WhatsApp-style incoming call surface: big Answer/Decline buttons,
            // caller identity, and full-screen presentation on the lockscreen.
            Person caller = new Person.Builder()
                .setName(callerName)
                .setIcon(IconCompat.createWithBitmap(picture))
                .setImportant(true)
                .build();
            builder.setStyle(
                NotificationCompat.CallStyle.forIncomingCall(caller, declineIntent, answerIntent)
            );
        } else {
            builder
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setSound(sound)
                .setVibrate(new long[]{0, 700, 350, 700, 350, 700})
                .addAction(R.drawable.ic_stat_abiaconnect, "Decline", declineIntent)
                .addAction(R.drawable.ic_stat_abiaconnect, "Answer", answerIntent);
        }

        Notification notification = builder.build();
        // Keep ringing until answered, declined or the caller gives up (like a phone call).
        notification.flags |= Notification.FLAG_INSISTENT;
        wakeScreen();
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(notificationId, notification);
            ringingNotificationId = notificationId;
        }
    }
}
