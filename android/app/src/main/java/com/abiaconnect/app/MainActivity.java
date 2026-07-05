package com.abiaconnect.app;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

public class MainActivity extends BaseActivity {
    private static final int NOTIFICATION_PERMISSION_CODE = 100;

    private BroadcastReceiver hangupReceiver;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestNotificationPermission();
        installCallJsBridge();
        registerHangupReceiver();
        handleNotificationIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
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

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                    this,
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    NOTIFICATION_PERMISSION_CODE
                );
            }
        }
    }

    private void handleNotificationIntent(Intent intent) {
        if (intent == null) return;

        String type = intent.getStringExtra("notification_type");
        String callAction = intent.getStringExtra("call_action"); // "answer" | "open" | null
        String callId = intent.getStringExtra("call_id");
        String callerName = intent.getStringExtra("caller_name");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            if ("call".equals(type) || "call_ongoing".equals(type)) {
                setShowWhenLocked(true);
                setTurnScreenOn(true);
            }
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
        if (route == null || route.isEmpty()) return;

        new Handler(Looper.getMainLooper()).postDelayed(() -> dispatchRouteToWeb(route), 300);
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
    private void installCallJsBridge() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        getBridge().getWebView().addJavascriptInterface(new CallJsBridge(this), "AbiaCallBridge");
        getBridge().getWebView().addJavascriptInterface(
            new ApkInstallerBridge(this, getBridge()), "AbiaApkInstaller");
    }

    private void registerHangupReceiver() {
        hangupReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null || intent.getAction() == null) return;
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(hangupReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(hangupReceiver, filter);
        }
    }

    /** JS-facing bridge. Called from the web layer via window.AbiaCallBridge. */
    public static class CallJsBridge {
        private final Context context;

        CallJsBridge(Context context) {
            this.context = context.getApplicationContext();
        }

        @JavascriptInterface
        public void startCall(String callerName, String callId) {
            CallForegroundService.start(context, callerName, callId);
        }

        @JavascriptInterface
        public void endCall() {
            CallForegroundService.stop(context);
        }
    }
}
