package com.abiaconnect.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Base64;

import java.security.MessageDigest;
import java.security.SecureRandom;

/**
 * MainActivity is exported (it's the launcher), so any installed app can start
 * it with arbitrary extras. Intents we build ourselves (notification taps,
 * Answer buttons) carry a per-install secret; MainActivity only acts on
 * notification extras when that secret matches. Our PendingIntents are
 * FLAG_IMMUTABLE, so other apps can neither read nor forge the token.
 */
final class NotificationIntentGuard {
    static final String EXTRA_TOKEN = "abia_intent_token";
    private static final String PREFS = "abia_intent_guard";
    private static final String KEY = "token";

    private NotificationIntentGuard() {}

    static Intent sign(Context context, Intent intent) {
        return intent.putExtra(EXTRA_TOKEN, token(context));
    }

    static boolean isTrusted(Context context, Intent intent) {
        if (intent == null) return false;
        String supplied = intent.getStringExtra(EXTRA_TOKEN);
        if (supplied == null) return false;
        return MessageDigest.isEqual(supplied.getBytes(), token(context).getBytes());
    }

    private static synchronized String token(Context context) {
        SharedPreferences prefs = context.getApplicationContext()
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String t = prefs.getString(KEY, null);
        if (t == null) {
            byte[] bytes = new byte[32];
            new SecureRandom().nextBytes(bytes);
            t = Base64.encodeToString(bytes, Base64.NO_WRAP | Base64.URL_SAFE);
            prefs.edit().putString(KEY, t).apply();
        }
        return t;
    }
}
