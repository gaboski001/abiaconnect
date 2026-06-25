package com.abiaconnect.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import androidx.appcompat.app.ActionBarDrawerToggle;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.GravityCompat;
import com.abiaconnect.app.databinding.ActivityMainBinding;
import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends BaseActivity {
    private static final int NOTIFICATION_PERMISSION_CODE = 1001;
    private static final String TAG = "MainActivity";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // BUG #2 FIX: Wire up Navigation Drawer toggle
        if (binding != null && binding.drawerLayout != null && binding.toolbar != null) {
            ActionBarDrawerToggle toggle = new ActionBarDrawerToggle(
                this, binding.drawerLayout, binding.toolbar,
                R.string.navigation_drawer_open,
                R.string.navigation_drawer_close
            );
            binding.drawerLayout.addDrawerListener(toggle);
            toggle.syncState();
        }

        // FEATURE #4: Request Notification Permission for Android 13+
        requestNotificationPermission();

        // STEP 5: Get FCM token
        getFcmToken();

        // STEP 6: Handle notification tap
        handleNotificationIntent(getIntent());
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        handleNotificationIntent(intent);
    }

    private void handleNotificationIntent(android.content.Intent intent) {
        if (intent != null && intent.hasExtra("notification_type")) {
            String type = intent.getStringExtra("notification_type");
            String targetId = intent.getStringExtra("target_id");
            Log.d(TAG, "Notification tapped: type=" + type + ", targetId=" + targetId);
            
            // Logic to navigate within the web app or native screens
            // Since it's a BridgeActivity, you might send an event to the web layer
        }
    }

    private void getFcmToken() {
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (task.isSuccessful()) {
                String token = task.getResult();
                Log.d(TAG, "FCM Device token: " + token);
                // Send to backend via Bridge if needed or stored locally
            }
        });
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_CODE);
            }
        }
    }

    // Professional method to open drawer from web layer if bridged
    public void openNavigationDrawer() {
        runOnUiThread(() -> {
            if (binding != null && binding.drawerLayout != null) {
                binding.drawerLayout.openDrawer(GravityCompat.START);
            }
        });
    }
}
