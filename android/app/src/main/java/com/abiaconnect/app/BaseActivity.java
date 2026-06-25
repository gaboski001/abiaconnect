package com.abiaconnect.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import com.abiaconnect.app.databinding.ActivityMainBinding;

public class BaseActivity extends BridgeActivity {
    protected ActivityMainBinding binding;
    public static final String CHANNEL_ID = "abia_notifications";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // BUG #1 FIX: Ensure app doesn't cover system UI area incorrectly
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
        
        super.onCreate(savedInstanceState);
        
        // Initialize ViewBinding
        try {
            binding = ActivityMainBinding.inflate(getLayoutInflater());
            setContentView(binding.getRoot());
        } catch (Exception e) {
            // Fallback if binding fails
        }

        // Add window insets handling to root layout
        View root = binding != null ? binding.getRoot() : findViewById(android.R.id.content);
        if (root != null) {
            ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
                Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
                view.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
                return insets;
            });
        }

        // Responsive scaling checks
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().getSettings().setLoadWithOverviewMode(true);
            getBridge().getWebView().getSettings().setUseWideViewPort(true);
            getBridge().getWebView().getSettings().setSupportZoom(false);
            getBridge().getWebView().getSettings().setBuiltInZoomControls(false);

            // BUG #3 FIX: Resolve touch conflicts for sliders in WebView
            // This ensures horizontal swipes for sliders reach the WebView
            getBridge().getWebView().setOnTouchListener((v, event) -> {
                v.getParent().requestDisallowInterceptTouchEvent(true);
                return false;
            });
            
            // BUG #2 FIX: Ensure WebView allows drawing outside its bounds for shadows
            getBridge().getWebView().setClipChildren(false);
            getBridge().getWebView().setClipToPadding(false);
        }

        // FEATURE #4: Create Notification Channel
        createNotificationChannel();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "Abia Connect Notifications";
            String description = "Real-time updates and community alerts";
            int importance = NotificationManager.IMPORTANCE_HIGH;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            channel.enableLights(true);
            channel.enableVibration(true);
            channel.setShowBadge(true);
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }
}
