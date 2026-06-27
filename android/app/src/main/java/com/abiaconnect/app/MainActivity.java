package com.abiaconnect.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

public class MainActivity extends BaseActivity {
    private static final int NOTIFICATION_PERMISSION_CODE = 100;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestNotificationPermission();
        handleNotificationIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationIntent(intent);
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

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            String type = intent.getStringExtra("notification_type");
            if ("call".equals(type)) {
                setShowWhenLocked(true);
                setTurnScreenOn(true);
            }
        }

        final String route = intent.getStringExtra("url");
        if (route == null || route.isEmpty()) return;

        new Handler(Looper.getMainLooper()).postDelayed(() -> dispatchRouteToWeb(route), 900);
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
}
