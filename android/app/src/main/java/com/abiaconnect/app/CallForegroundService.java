package com.abiaconnect.app;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.text.TextUtils;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.drawable.IconCompat;

/**
 * Foreground service that keeps the process alive for the duration of an
 * active call. Started when the user taps "Answer" (or when the WebRTC
 * session actually connects) and stopped when the call ends.
 *
 * Using foregroundServiceType=phoneCall|microphone tells Android this is
 * an ongoing call, so it won't kill the app when MainActivity is backgrounded
 * and the mic keeps working from the background on Android 14+.
 */
public class CallForegroundService extends Service {
    private static final String TAG = "AbiaCallService";
    private static final int NOTIFICATION_ID = 424242;

    public static final String ACTION_START = "com.abiaconnect.app.CALL_SERVICE_START";
    public static final String ACTION_STOP = "com.abiaconnect.app.CALL_SERVICE_STOP";
    public static final String EXTRA_CALLER_NAME = "caller_name";
    public static final String EXTRA_CALL_ID = "call_id";

    public static void start(Context context, String callerName, String callId) {
        Intent intent = new Intent(context, CallForegroundService.class);
        intent.setAction(ACTION_START);
        intent.putExtra(EXTRA_CALLER_NAME, callerName);
        intent.putExtra(EXTRA_CALL_ID, callId);
        ContextCompat.startForegroundService(context, intent);
    }

    public static void stop(Context context) {
        Intent intent = new Intent(context, CallForegroundService.class);
        intent.setAction(ACTION_STOP);
        context.startService(intent);
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;

        if (ACTION_STOP.equals(action)) {
            Log.d(TAG, "Stopping call foreground service");
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        String callerName = intent != null ? intent.getStringExtra(EXTRA_CALLER_NAME) : null;
        String callId = intent != null ? intent.getStringExtra(EXTRA_CALL_ID) : null;
        if (TextUtils.isEmpty(callerName)) callerName = "AbiaConnect call";

        Notification notification = buildOngoingCallNotification(callerName, callId);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL
                        | ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                );
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL
                );
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to start foreground: " + e.getMessage());
            stopSelf();
            return START_NOT_STICKY;
        }

        // START_STICKY keeps the service alive if the system briefly reclaims it.
        return START_STICKY;
    }

    private Notification buildOngoingCallNotification(String callerName, String callId) {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        openIntent.putExtra("notification_type", "call_ongoing");
        openIntent.putExtra("call_id", callId);
        PendingIntent contentIntent = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent hangupIntent = new Intent(this, CallActionReceiver.class);
        hangupIntent.setAction(CallActionReceiver.ACTION_HANGUP_CALL);
        hangupIntent.putExtra("call_id", callId);
        PendingIntent hangupPending = PendingIntent.getBroadcast(
            this, 1, hangupIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, BaseActivity.CALL_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_abiaconnect)
            .setColor(ContextCompat.getColor(this, R.color.notification_color))
            .setColorized(true)
            .setContentTitle(callerName)
            .setContentText("Call in progress")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setUsesChronometer(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(contentIntent);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Person caller = new Person.Builder()
                .setName(callerName)
                .setIcon(IconCompat.createWithResource(this, R.drawable.ic_stat_abiaconnect))
                .setImportant(true)
                .build();
            builder.setStyle(NotificationCompat.CallStyle.forOngoingCall(caller, hangupPending));
        } else {
            builder.addAction(R.drawable.ic_stat_abiaconnect, "Hang up", hangupPending);
        }

        return builder.build();
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "CallForegroundService destroyed");
        super.onDestroy();
    }
}
