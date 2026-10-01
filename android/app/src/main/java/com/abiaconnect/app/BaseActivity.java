package com.abiaconnect.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.FrameLayout;

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
    /** Longest the launch overlay waits for the web app after the page loads. */
    private static final long OVERLAY_MAX_MS = 5000;
    private static final long OVERLAY_POLL_MS = 80;
    private static final long OVERLAY_FADE_MS = 350;
    private volatile boolean webContentReady = false;
    private View launchOverlay;
    private long overlayDeadline = 0;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        final long splashDeadline = SystemClock.uptimeMillis() + SPLASH_MAX_MS;
        splash.setKeepOnScreenCondition(
            () -> !webContentReady && SystemClock.uptimeMillis() < splashDeadline
        );
        // The launch overlay underneath is an exact copy of the splash, so remove
        // the splash instantly rather than fading it (a fade dims the logo).
        splash.setOnExitAnimationListener(provider -> provider.remove());
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);

        super.onCreate(savedInstanceState);

        if (getBridge() != null) {
            getBridge().addWebViewListener(new WebViewListener() {
                @Override
                public void onPageLoaded(WebView webView) {
                    webContentReady = true;
                    waitForWebLaunchThenReveal();
                }

                @Override
                public void onReceivedError(WebView webView) {
                    // Show the app's own offline/error UI instead of waiting.
                    webContentReady = true;
                    hideLaunchOverlay();
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
            // Same colour as the splash, so there is never a white flash.
            getBridge().getWebView().setBackgroundColor(ContextCompat.getColor(this, R.color.splash_background));
            getBridge().getWebView().getSettings().setLoadWithOverviewMode(true);
            getBridge().getWebView().getSettings().setUseWideViewPort(true);
            getBridge().getWebView().setClipChildren(false);
            getBridge().getWebView().setClipToPadding(false);
        }

        showLaunchOverlay();
        createNotificationChannels();
    }

    /**
     * Launch overlay: a native copy of the splash (navy + logo, centred on the
     * whole screen) laid over the WebView. When the system splash goes away the
     * member keeps seeing the same logo — never a blank frame while the web app
     * paints — and it fades out once the web app says its first screen is ready
     * (index.html sets the `cap-launch` class; the app removes it when ready).
     */
    private void showLaunchOverlay() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        // Also the window background, which covers the very first frame after
        // the system splash, before any view has drawn.
        getWindow().setBackgroundDrawableResource(R.drawable.launch_background);
        launchOverlay = new View(this);
        launchOverlay.setBackgroundResource(R.drawable.launch_background);
        launchOverlay.setClickable(true); // swallow taps until revealed
        ((ViewGroup) getWindow().getDecorView()).addView(
            launchOverlay,
            new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        );
    }

    private void waitForWebLaunchThenReveal() {
        if (launchOverlay == null) return;
        if (overlayDeadline == 0) overlayDeadline = SystemClock.uptimeMillis() + OVERLAY_MAX_MS;
        if (SystemClock.uptimeMillis() > overlayDeadline || getBridge() == null || getBridge().getWebView() == null) {
            hideLaunchOverlay();
            return;
        }
        getBridge().getWebView().evaluateJavascript(
            "document.documentElement.classList.contains('cap-launch')",
            value -> {
                if ("true".equals(value)) {
                    mainHandler.postDelayed(this::waitForWebLaunchThenReveal, OVERLAY_POLL_MS);
                } else {
                    hideLaunchOverlay();
                }
            }
        );
    }

    private void hideLaunchOverlay() {
        mainHandler.post(() -> {
            final View overlay = launchOverlay;
            if (overlay == null) return;
            launchOverlay = null;
            overlay.animate()
                .alpha(0f)
                .setDuration(OVERLAY_FADE_MS)
                .withEndAction(() -> {
                    ViewGroup parent = (ViewGroup) overlay.getParent();
                    if (parent != null) parent.removeView(overlay);
                    getWindow().setBackgroundDrawableResource(R.color.splash_background);
                })
                .start();
        });
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
