package com.abiaconnect.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.appcompat.app.ActionBarDrawerToggle;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.GravityCompat;

import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends BaseActivity {
    private static final String TAG = "MainActivity";
    private static final int NOTIFICATION_PERMISSION_CODE = 100;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // BUG 2: Wire up Navigation Drawer toggle
        if (binding != null && binding.drawerLayout != null && binding.toolbar != null) {
            ActionBarDrawerToggle toggle = new ActionBarDrawerToggle(
                this, binding.drawerLayout, binding.toolbar,
                R.string.navigation_drawer_open,
                R.string.navigation_drawer_close
            );
            binding.drawerLayout.addDrawerListener(toggle);
            toggle.syncState();
        }

        // FEATURE (FCM): Request Notification Permission for Android 13+
        requestNotificationPermission();

        // FEATURE (FCM): Get and log FCM token
        getFcmToken();

        // FEATURE (FCM): Handle notification tap
        handleNotificationIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleNotificationIntent(intent);
    }

    private void handleNotificationIntent(Intent intent) {
        if (intent != null && intent.hasExtra("notification_type")) {
            String type = intent.getStringExtra("notification_type");
            String targetId = intent.getStringExtra("target_id");
            Log.d(TAG, "Notification tapped: type=" + type + ", targetId=" + targetId);
            
            // TODO: Implement navigation logic based on 'type' and 'targetId'
            // For example, navigate to a specific URL in the WebView
        }
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_CODE);
            }
        }
    }

    private void getFcmToken() {
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (task.isSuccessful()) {
                String token = task.getResult();
                Log.d(TAG, "FCM Device token: " + token);
                // Send this token to backend associated with current user
            } else {
                Log.w(TAG, "Fetching FCM registration token failed", task.getException());
            }
        });
    }

    // Bridge method to open drawer from Web layer
    public void openNavigationDrawer() {
        runOnUiThread(() -> {
            if (binding != null && binding.drawerLayout != null) {
                binding.drawerLayout.openDrawer(GravityCompat.START);
            }
        });
    }
}
