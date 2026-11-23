package com.abiaconnect.app;

import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * window.AbiaFingerprint: Android's own fingerprint screen, shown directly.
 *
 * The fingerprint add-on runs an extra key check after a good touch, and on some phones
 * (Pixel, Nov 2026) that check always fails ("Biometric security check failed"), so
 * fingerprint sign-in could never be turned on. This asks only "is this the phone's owner?"
 * with strong unlock (fingerprint); the saved sign-in stays encrypted by the add-on.
 *
 * The answer arrives as a window event 'abia-fingerprint-result' with {ok, code, message}.
 */
final class FingerprintBridge {

    private final FragmentActivity activity;
    private final WebView webView;
    private volatile boolean busy = false;

    FingerprintBridge(FragmentActivity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    /** True when a strong unlock (fingerprint) is set up on this phone. */
    @JavascriptInterface
    public boolean isAvailable() {
        return BiometricManager.from(activity).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            == BiometricManager.BIOMETRIC_SUCCESS;
    }

    @JavascriptInterface
    public void verify(String title, String subtitle, String cancelText) {
        if (busy) return;
        busy = true;
        activity.runOnUiThread(() -> {
            try {
                BiometricPrompt.PromptInfo.Builder info = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title == null || title.isEmpty() ? "Confirm it's you" : title)
                    .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                    .setNegativeButtonText(cancelText == null || cancelText.isEmpty() ? "Cancel" : cancelText)
                    .setConfirmationRequired(false);
                if (subtitle != null && !subtitle.isEmpty()) info.setSubtitle(subtitle);

                BiometricPrompt prompt = new BiometricPrompt(
                    activity,
                    ContextCompat.getMainExecutor(activity),
                    new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                            send(true, 0, "");
                        }

                        @Override
                        public void onAuthenticationError(int code, @NonNull CharSequence message) {
                            send(false, code, message.toString());
                        }
                        // onAuthenticationFailed (a misread touch): Android lets them try again itself.
                    }
                );
                prompt.authenticate(info.build());
            } catch (Exception e) {
                send(false, -1, e.getMessage() == null ? "Fingerprint screen could not open" : e.getMessage());
            }
        });
    }

    private void send(boolean ok, int code, String message) {
        busy = false;
        JSONObject detail = new JSONObject();
        try {
            detail.put("ok", ok);
            detail.put("code", code);
            detail.put("message", message);
        } catch (JSONException ignored) {
            // cannot happen with these values
        }
        final String script = "window.dispatchEvent(new CustomEvent('abia-fingerprint-result', { detail: " + detail + " }));";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }
}
