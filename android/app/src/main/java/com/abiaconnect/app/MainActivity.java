package com.abiaconnect.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends BaseActivity {
    private static final String TAG = "MainActivity";
    private static final int NOTIFICATION_PERMISSION_CODE = 100;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // FCM: Request Notification Permission for Android 13+
        requestNotificationPermission();

        // FCM: Get and log Device Token
        getFcmToken();

        // FCM: Handle notification tap
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
        try {
            // Check if Firebase is initialized before calling getInstance
            // This prevents immediate crashes if google-services.json is missing
            com.google.firebase.FirebaseApp app = com.google.firebase.FirebaseApp.getInstance();
            if (app == null) {
                Log.e(TAG, "Firebase not initialized: google-services.json might be missing");
                return;
            }

            FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                if (task.isSuccessful()) {
                    String token = task.getResult();
                    Log.d(TAG, "FCM Device token: " + token);
                } else {
                    Log.e(TAG, "FCM token request failed", task.getException());
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Error accessing Firebase. Check if google-services.json is present in android/app/", e);
        }
    }
}
