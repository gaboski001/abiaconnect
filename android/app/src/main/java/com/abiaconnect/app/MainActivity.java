package com.abiaconnect.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.content.ActivityNotFoundException;
import android.net.Uri;
import androidx.browser.customtabs.CustomTabsIntent;
import org.json.JSONException;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;

import androidx.core.content.ContextCompat;

import org.json.JSONObject;

public class MainActivity extends BaseActivity {

    private BroadcastReceiver hangupReceiver;
    private volatile String pendingGoogleReturn;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        installCallJsBridge();
        installAuthJsBridge();
        handleGoogleReturn(getIntent());
        registerHangupReceiver();
        handleNotificationIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleGoogleReturn(intent);
        handleNotificationIntent(intent);
    }

    @Override
    public void onDestroy() {
        if (hangupReceiver != null) {
            try { unregisterReceiver(hangupReceiver); } catch (Exception ignored) {}
            hangupReceiver = null;
        }
        super.onDestroy();
    }

    private void handleNotificationIntent(Intent intent) {
        if (intent == null) return;
        // MainActivity is exported: ignore notification extras unless the
        // intent was built by us (see NotificationIntentGuard).
        if (!NotificationIntentGuard.isTrusted(this, intent)) return;

        String type = intent.getStringExtra("notification_type");
        String callAction = intent.getStringExtra("call_action"); // "answer" | "open" | null
        String callId = intent.getStringExtra("call_id");
        String callerName = intent.getStringExtra("caller_name");

        if ("call".equals(type) || "call_ongoing".equals(type)) {
            setLockScreenCallMode(true);
        }

        // Any call interaction (Answer or opening the ringing UI) must clear the
        // ringing notification so the ringtone/vibration stops immediately and
        // future calls aren't blocked.
        if ("call".equals(type)) {
            int notificationId = intent.getIntExtra("notification_id", -1);
            android.app.NotificationManager manager =
                (android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (manager != null && notificationId != -1) {
                manager.cancel(notificationId);
            }

            if ("answer".equals(callAction)) {
                // Promote to a foreground call session BEFORE routing so Android
                // keeps the process (and WebRTC peer connection) alive.
                CallForegroundService.start(this, callerName, callId);
                // Tell the web layer to accept the call (SDP answer, etc.) and
                // navigate to the in-call screen without a page reload.
                dispatchCallAnswerToWeb(callId);
            }
        }

        final String route = intent.getStringExtra("url");
        if (!isSafeInAppRoute(route)) return;

        new Handler(Looper.getMainLooper()).postDelayed(() -> dispatchRouteToWeb(route), 300);
    }

    /** Only same-origin paths like "/messages/123" — no schemes, no "//host". */
    private static boolean isSafeInAppRoute(String route) {
        return route != null
            && route.startsWith("/")
            && !route.startsWith("//")
            && !route.contains("\\")
            && route.length() <= 512;
    }

    /**
     * Show over the lock screen / wake the display only while a call is
     * ringing or active — never for normal app use, otherwise anyone holding
     * a locked phone could read the user's messages.
     */
    void setLockScreenCallMode(boolean enabled) {
        runOnUiThread(() -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                setShowWhenLocked(enabled);
                setTurnScreenOn(enabled);
            } else {
                int flags = android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON;
                if (enabled) getWindow().addFlags(flags);
                else getWindow().clearFlags(flags);
            }
        });
    }

    private void dispatchCallAnswerToWeb(String callId) {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        getBridge().getWebView().post(() -> {
            try {
                String safe = JSONObject.quote(callId == null ? "" : callId);
                String script = "window.dispatchEvent(new CustomEvent('abiaconnect-native-call-answer', { detail: { callId: " + safe + " } }));";
                getBridge().getWebView().evaluateJavascript(script, null);
            } catch (Exception ignored) {}
        });
    }

    private void dispatchRouteToWeb(String route) {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        try {
            String safeRoute = JSONObject.quote(route);
            String script = "window.dispatchEvent(new CustomEvent('abiaconnect-native-notification', { detail: { url: " + safeRoute + " } }));";
            getBridge().getWebView().evaluateJavascript(script, null);
        } catch (Exception ignored) {
        }
    }

    /**
     * Exposes window.AbiaCallBridge.startCall / endCall to the web layer,
     * so the WebRTC code can start the foreground call service when a call
     * actually connects (outgoing calls) and stop it when the call ends.
     */
    private void installAuthJsBridge() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        getBridge().getWebView().addJavascriptInterface(new AuthJsBridge(), "AbiaAuthBridge");
    }

    /** Keeps what the browser tab handed back until the web app collects it. */
    private void handleGoogleReturn(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        Uri data = intent.getData();
        if (!"com.abiaconnect.app".equals(data.getScheme()) || !"google-return".equals(data.getHost())) return;
        try {
            JSONObject result = new JSONObject();
            for (String key : new String[]{"n", "at", "rt", "err"}) {
                String value = intent.getStringExtra(key);
                if (value != null) result.put(key, value);
            }
            pendingGoogleReturn = result.toString();
        } catch (JSONException e) {
            return;
        } finally {
            intent.setData(null);
        }
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(
                "window.dispatchEvent(new Event('abia-google-return'))", null));
        }
    }

    private class AuthJsBridge {
        @JavascriptInterface
        public void openGoogle(String url) {
            Uri uri = Uri.parse(url);
            if (!"https".equals(uri.getScheme()) || !"abiaconnect.com".equals(uri.getHost())) return;
            if (uri.getPath() == null || !uri.getPath().startsWith("/~oauth/")) return;
            runOnUiThread(() -> {
                try {
                    new CustomTabsIntent.Builder().build().launchUrl(MainActivity.this, uri);
                } catch (ActivityNotFoundException ignored) {
                    // No browser on the phone: nothing can be opened.
                }
            });
        }

        @JavascriptInterface
        public String takeGoogleReturn() {
            String result = pendingGoogleReturn;
            pendingGoogleReturn = null;
            return result;
        }
    }

    private void installCallJsBridge() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        getBridge().getWebView().addJavascriptInterface(new CallJsBridge(this), "AbiaCallBridge");
    }

    private void registerHangupReceiver() {
        hangupReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null || intent.getAction() == null) return;
                setLockScreenCallMode(false);
                String eventName = "com.abiaconnect.app.CALL_DECLINE".equals(intent.getAction())
                    ? "abiaconnect-native-call-decline"
                    : "abiaconnect-native-call-hangup";
                String callId = intent.getStringExtra("call_id");
                if (getBridge() != null && getBridge().getWebView() != null) {
                    final String safeId = JSONObject.quote(callId == null ? "" : callId);
                    final String script =
                        "window.dispatchEvent(new CustomEvent('" + eventName +
                        "', { detail: { callId: " + safeId + " } }));";
                    getBridge().getWebView().post(() ->
                        getBridge().getWebView().evaluateJavascript(script, null)
                    );
                }
            }
        };
        IntentFilter filter = new IntentFilter();
        filter.addAction("com.abiaconnect.app.CALL_HANGUP");
        filter.addAction("com.abiaconnect.app.CALL_DECLINE");
        // NOT_EXPORTED on every API level (ContextCompat protects it with a
        // signature permission below Android 13) so other apps can't spoof hangups.
        ContextCompat.registerReceiver(this, hangupReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    /** JS-facing bridge. Called from the web layer via window.AbiaCallBridge. */
    public static class CallJsBridge {
        private final Context context;
        private final java.lang.ref.WeakReference<MainActivity> activity;

        CallJsBridge(MainActivity activity) {
            this.context = activity.getApplicationContext();
            this.activity = new java.lang.ref.WeakReference<>(activity);
        }

        @JavascriptInterface
        public void startCall(String callerName, String callId) {
            CallForegroundService.start(context, clip(callerName, 80), clip(callId, 128));
        }

        @JavascriptInterface
        public void endCall() {
            CallForegroundService.stop(context);
            MainActivity a = activity.get();
            if (a != null) a.setLockScreenCallMode(false);
        }

        /**
         * Call audio routing: "speaker", "earpiece" or "reset" (call over).
         * "earpiece" prefers a connected headset (wired, USB or Bluetooth) so
         * we never pull audio away from someone's earphones.
         */
        @JavascriptInterface
        public void setAudioRoute(String route) {
            AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (am == null) return;
            try {
                if ("reset".equals(route)) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) am.clearCommunicationDevice();
                    else am.setSpeakerphoneOn(false);
                    am.setMode(AudioManager.MODE_NORMAL);
                    return;
                }
                boolean speaker = "speaker".equals(route);
                am.setMode(AudioManager.MODE_IN_COMMUNICATION);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    AudioDeviceInfo chosen = null;
                    for (AudioDeviceInfo d : am.getAvailableCommunicationDevices()) {
                        int t = d.getType();
                        if (speaker) {
                            if (t == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) { chosen = d; break; }
                        } else if (t == AudioDeviceInfo.TYPE_WIRED_HEADSET
                            || t == AudioDeviceInfo.TYPE_WIRED_HEADPHONES
                            || t == AudioDeviceInfo.TYPE_USB_HEADSET
                            || t == AudioDeviceInfo.TYPE_BLUETOOTH_SCO
                            || t == AudioDeviceInfo.TYPE_BLE_HEADSET) {
                            chosen = d;
                            break;
                        } else if (t == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE && chosen == null) {
                            chosen = d;
                        }
                    }
                    if (chosen != null) am.setCommunicationDevice(chosen);
                } else {
                    // Off = default routing, which already prefers a headset.
                    am.setSpeakerphoneOn(speaker);
                }
            } catch (Exception ignored) {
                // Routing is best effort; never break the call over it.
            }
        }

        /** Keeps the screen from going to sleep while in a live room. */
        @JavascriptInterface
        public void setKeepScreenOn(boolean on) {
            MainActivity a = activity.get();
            if (a == null) return;
            a.runOnUiThread(() -> {
                if (on) a.getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else a.getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        private static String clip(String s, int max) {
            return s == null || s.length() <= max ? s : s.substring(0, max);
        }
    }
}
