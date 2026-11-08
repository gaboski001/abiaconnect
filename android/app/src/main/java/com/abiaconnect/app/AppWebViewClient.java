package com.abiaconnect.app;

import android.app.Activity;
import android.util.Log;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Two things Capacitor's own WebView client does not do for an app that loads
 * its pages from the internet:
 *
 *  - No network: Android's grey error page with codes like
 *    net::ERR_INTERNET_DISCONNECTED. We show our own "No internet connection"
 *    screen instead (assets/offline.html), which opens the page again by itself
 *    when the connection is back.
 *  - The page engine stops (Android reclaims its memory, e.g. with the screen off
 *    during a live room, or it crashes): by default the whole app closes. We
 *    start the screen again instead, so the member stays in the app.
 */
public class AppWebViewClient extends BridgeWebViewClient {
    private static final String TAG = "AbiaWebViewClient";
    private static final String HOME = "https://abiaconnect.com/";

    private final Activity activity;

    public AppWebViewClient(Bridge bridge, Activity activity) {
        super(bridge);
        this.activity = activity;
    }

    @Override
    public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        super.onReceivedError(view, request, error);
        if (request == null || !request.isForMainFrame() || error == null) return;
        if (!isNoConnection(error.getErrorCode(), String.valueOf(error.getDescription()))) return;
        String failed = request.getUrl() != null ? request.getUrl().toString() : HOME;
        showOffline(view, failed.startsWith(HOME) ? failed : HOME);
    }

    private static boolean isNoConnection(int code, String description) {
        if (code == WebViewClient.ERROR_HOST_LOOKUP
            || code == WebViewClient.ERROR_CONNECT
            || code == WebViewClient.ERROR_TIMEOUT) return true;
        // Other codes are also used for things like a cancelled page; only the network ones count.
        return description.contains("ERR_INTERNET_DISCONNECTED")
            || description.contains("ERR_NAME_NOT_RESOLVED")
            || description.contains("ERR_NETWORK_CHANGED")
            || description.contains("ERR_ADDRESS_UNREACHABLE")
            || description.contains("ERR_CONNECTION_")
            || description.contains("ERR_TIMED_OUT");
    }

    private void showOffline(WebView view, String returnUrl) {
        String html = readAsset("offline.html");
        if (html == null) return;
        // The return address only ever holds our own site's address (checked above and in the page).
        html = html.replace("__RETURN_URL__", returnUrl.replace("\\", "").replace("\"", "%22").replace("<", "%3C"));
        view.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
    }

    private String readAsset(String name) {
        try (InputStream in = activity.getAssets().open(name)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString(StandardCharsets.UTF_8.name());
        } catch (Exception e) {
            Log.w(TAG, "Offline page missing: " + e.getMessage());
            return null;
        }
    }

    @Override
    public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
        super.onRenderProcessGone(view, detail);
        Log.w(TAG, "Page engine stopped (crashed: " + detail.didCrash() + "); starting the screen again");
        // The old WebView can't be used again; the new screen makes a fresh one.
        activity.runOnUiThread(activity::recreate);
        // true = we handled it, so Android does not close the app.
        return true;
    }
}
