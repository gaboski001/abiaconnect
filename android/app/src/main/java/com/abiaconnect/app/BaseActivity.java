package com.abiaconnect.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class BaseActivity extends BridgeActivity {
    public static final String CHANNEL_ID = "default_channel";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Apply window configuration before super.onCreate
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
        
        super.onCreate(savedInstanceState);

        // Force status bar color to Forest Green (Brand Matching)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(ContextCompat.getColor(this, R.color.status_bar_color));
        }

        // Capacitor 6 handles layout and webview automatically.
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().getSettings().setLoadWithOverviewMode(true);
            getBridge().getWebView().getSettings().setUseWideViewPort(true);
            
            // Allow web content to draw outside its bounds (for shadows/glows)
            getBridge().getWebView().setClipChildren(false);
            getBridge().getWebView().setClipToPadding(false);
        }

        createNotificationChannel();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "App Notifications";
            String description = "Real-time app notifications";
            int importance = NotificationManager.IMPORTANCE_HIGH;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            channel.enableLights(true);
            channel.setLightColor(android.graphics.Color.GREEN);
            channel.enableVibration(true);
            channel.setShowBadge(true);
            
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }
}
