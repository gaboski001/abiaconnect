package com.abiaconnect.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.webkit.JavascriptInterface;

import androidx.core.content.FileProvider;

import com.getcapacitor.Bridge;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * JS-facing bridge that downloads an APK to app-private storage and launches
 * the Android package installer via FileProvider — keeping the whole update
 * flow inside the app instead of handing off to the browser + notifications.
 *
 * Exposed to the web layer as `window.AbiaApkInstaller`.
 *  - installFromUrl(url, filename)       – kick off download + install
 *  - openInstallSettings()               – jump the user to "Install unknown apps"
 *
 * Progress + status events are dispatched back to the WebView as CustomEvents:
 *   window.addEventListener('abiaconnect-apk-progress', e => e.detail)
 *   window.addEventListener('abiaconnect-apk-error', e => e.detail)
 *   window.addEventListener('abiaconnect-apk-installing', e => e.detail)
 */
public class ApkInstallerBridge {
    private final Activity activity;
    private final Bridge bridge;
    private volatile Thread worker;

    ApkInstallerBridge(Activity activity, Bridge bridge) {
        this.activity = activity;
        this.bridge = bridge;
    }

    @JavascriptInterface
    public boolean canInstall() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        try {
            return activity.getPackageManager().canRequestPackageInstalls();
        } catch (Exception e) {
            return false;
        }
    }

    @JavascriptInterface
    public void openInstallSettings() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        try {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
                .setData(Uri.parse("package:" + activity.getPackageName()))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(i);
        } catch (Exception ignored) {}
    }

    @JavascriptInterface
    public void installFromUrl(final String url, final String filename) {
        if (url == null || url.isEmpty()) return;
        if (worker != null && worker.isAlive()) return;

        worker = new Thread(() -> {
            HttpURLConnection conn = null;
            InputStream in = null;
            FileOutputStream out = null;
            File outFile = null;
            try {
                File dir = new File(activity.getExternalFilesDir(null), "updates");
                if (!dir.exists()) //noinspection ResultOfMethodCallIgnored
                    dir.mkdirs();

                // Clean older APKs so we don't fill the cache after several updates.
                File[] old = dir.listFiles();
                if (old != null) for (File f : old) //noinspection ResultOfMethodCallIgnored
                    f.delete();

                String safeName = filename == null || filename.isEmpty() ? "update.apk" : filename;
                outFile = new File(dir, safeName);

                conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setConnectTimeout(20000);
                conn.setReadTimeout(60000);
                conn.setRequestProperty("Accept", "application/vnd.android.package-archive, */*");
                conn.connect();

                int code = conn.getResponseCode();
                if (code < 200 || code >= 300) {
                    dispatchError("Download failed (HTTP " + code + ")");
                    return;
                }

                long total = conn.getContentLengthLong();
                in = conn.getInputStream();
                out = new FileOutputStream(outFile);

                byte[] buf = new byte[64 * 1024];
                long loaded = 0;
                long lastEmit = 0;
                long started = System.currentTimeMillis();
                int n;
                while ((n = in.read(buf)) > 0) {
                    if (Thread.currentThread().isInterrupted()) {
                        //noinspection ResultOfMethodCallIgnored
                        outFile.delete();
                        return;
                    }
                    out.write(buf, 0, n);
                    loaded += n;
                    long now = System.currentTimeMillis();
                    if (now - lastEmit >= 150) {
                        lastEmit = now;
                        double secs = Math.max(0.001, (now - started) / 1000.0);
                        double speed = loaded / secs;
                        dispatchProgress(loaded, total, speed);
                    }
                }
                out.flush();
                dispatchProgress(loaded, total > 0 ? total : loaded, 0);

                launchInstaller(outFile);
            } catch (Exception e) {
                dispatchError(e.getMessage() == null ? "Download failed" : e.getMessage());
                if (outFile != null) //noinspection ResultOfMethodCallIgnored
                    outFile.delete();
            } finally {
                try { if (out != null) out.close(); } catch (Exception ignored) {}
                try { if (in != null) in.close(); } catch (Exception ignored) {}
                if (conn != null) conn.disconnect();
            }
        }, "abia-apk-download");
        worker.start();
    }

    private void launchInstaller(File apk) {
        activity.runOnUiThread(() -> {
            try {
                // Android 8+: requires user to grant "install unknown apps" first.
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    && !activity.getPackageManager().canRequestPackageInstalls()) {
                    dispatchInstalling(apk.getAbsolutePath(), false);
                    openInstallSettings();
                    return;
                }

                Uri uri = FileProvider.getUriForFile(
                    activity,
                    activity.getPackageName() + ".fileprovider",
                    apk
                );
                Intent install = new Intent(Intent.ACTION_VIEW)
                    .setDataAndType(uri, "application/vnd.android.package-archive")
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                activity.startActivity(install);
                dispatchInstalling(apk.getAbsolutePath(), true);
            } catch (Exception e) {
                dispatchError("Could not open installer: " + (e.getMessage() == null ? "unknown" : e.getMessage()));
            }
        });
    }

    private void dispatchProgress(long loaded, long total, double speed) {
        emit("abiaconnect-apk-progress",
            "{\"loaded\":" + loaded + ",\"total\":" + total + ",\"speed\":" + speed + "}");
    }

    private void dispatchInstalling(String path, boolean launched) {
        emit("abiaconnect-apk-installing",
            "{\"path\":" + JSONObject.quote(path) + ",\"launched\":" + launched + "}");
    }

    private void dispatchError(String message) {
        emit("abiaconnect-apk-error", "{\"message\":" + JSONObject.quote(message) + "}");
    }

    private void emit(String event, String detailJson) {
        if (bridge == null || bridge.getWebView() == null) return;
        final String script =
            "window.dispatchEvent(new CustomEvent('" + event + "', { detail: " + detailJson + " }));";
        bridge.getWebView().post(() -> bridge.getWebView().evaluateJavascript(script, null));
    }
}
