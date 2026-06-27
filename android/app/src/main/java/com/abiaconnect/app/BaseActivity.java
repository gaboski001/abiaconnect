package com.abiaconnect.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import androidx.core.content.ContextCompat;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

@SuppressWarnings("deprecation")
public class BaseActivity extends BridgeActivity {
    public static final String CHANNEL_ID = "abia_default";
    public static final String CALL_CHANNEL_ID = "abia_calls";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);

        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(ContextCompat.getColor(this, R.color.status_bar_color));
            getWindow().setNavigationBarColor(ContextCompat.getColor(this, R.color.navigationBarColor));
        }

        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().getSettings().setLoadWithOverviewMode(true);
            getBridge().getWebView().getSettings().setUseWideViewPort(true);
            getBridge().getWebView().setClipChildren(false);
            getBridge().getWebView().setClipToPadding(false);
        }

        createNotificationChannels();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager notificationManager = getSystemService(NotificationManager.class);
        if (notificationManager == null) return;

        NotificationChannel defaultChannel = new NotificationChannel(
            CHANNEL_ID,
            getString(R.string.push_default_channel_name),
            NotificationManager.IMPORTANCE_HIGH
        );
        defaultChannel.setDescription(getString(R.string.push_default_channel_description));
        defaultChannel.enableLights(true);
        defaultChannel.setLightColor(ContextCompat.getColor(this, R.color.notification_color));
        defaultChannel.enableVibration(true);
        defaultChannel.setShowBadge(true);
        defaultChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        notificationManager.createNotificationChannel(defaultChannel);

        Uri ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();

        NotificationChannel callChannel = new NotificationChannel(
            CALL_CHANNEL_ID,
            getString(R.string.push_call_channel_name),
            NotificationManager.IMPORTANCE_HIGH
        );
        callChannel.setDescription(getString(R.string.push_call_channel_description));
        callChannel.enableLights(true);
        callChannel.setLightColor(ContextCompat.getColor(this, R.color.notification_color));
        callChannel.enableVibration(true);
        callChannel.setShowBadge(false);
        callChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        callChannel.setSound(ringtone, audioAttributes);
        notificationManager.createNotificationChannel(callChannel);
    }
}
