package com.abiaconnect.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.webkit.WebView;

import androidx.core.content.ContextCompat;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

@SuppressWarnings("deprecation")
public class BaseActivity extends BridgeActivity {
    public static final String CHANNEL_ID = "abia_default";
    public static final String CALL_CHANNEL_ID = "abia_calls";

    /**
     * Tracks whether the app's Activity is currently visible & interactive.
     * When true, FCM should NOT post the loud system incoming-call notification
     * — the in-app CallOverlay + realtime signaling handles the UI, so the
     * device doesn't ring twice at the same time.
     */
    private static volatile boolean sAppInForeground = false;

    public static boolean isAppInForeground() {
        return sAppInForeground;
    }

    @Override
    public void onResume() {
        super.onResume();
        sAppInForeground = true;
    }

    @Override
    public void onPause() {
        sAppInForeground = false;
        super.onPause();
    }

    /**
     * Keep the launch splash (real logo) up until the web app has painted, so
     * members never see a blank white WebView or a half-loaded page. Capped so
     * a slow or failed network can never trap the app on the splash.
     */
    private static final long SPLASH_MAX_MS = 3000;
    private volatile boolean webContentReady = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        final long splashDeadline = SystemClock.uptimeMillis() + SPLASH_MAX_MS;
        splash.setKeepOnScreenCondition(
            () -> !webContentReady && SystemClock.uptimeMillis() < splashDeadline
        );
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);

        super.onCreate(savedInstanceState);

        if (getBridge() != null) {
            getBridge().addWebViewListener(new WebViewListener() {
                @Override
                public void onPageLoaded(WebView webView) {
                    webContentReady = true;
                }

                @Override
                public void onReceivedError(WebView webView) {
                    // Show the app's own offline/error UI instead of waiting.
                    webContentReady = true;
                }
            });
        } else {
            webContentReady = true;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(ContextCompat.getColor(this, R.color.status_bar_color));
            getWindow().setNavigationBarColor(ContextCompat.getColor(this, R.color.navigationBarColor));
        }

        if (getBridge() != null && getBridge().getWebView() != null) {
            // Same colour as the splash, so there is no white flash between the
            // splash and the first painted page.
            getBridge().getWebView().setBackgroundColor(ContextCompat.getColor(this, R.color.splash_background));
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
        callChannel.setVibrationPattern(new long[]{0, 800, 600, 800, 600, 800});
        callChannel.setShowBadge(false);
        callChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        callChannel.setBypassDnd(true);
        callChannel.setSound(ringtone, audioAttributes);
        notificationManager.createNotificationChannel(callChannel);
    }
}
