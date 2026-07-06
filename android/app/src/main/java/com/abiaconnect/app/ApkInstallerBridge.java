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
 *  - installFromUrl(url, filename)  – download (or reuse cached) and install
 *  - installExisting(filename)      – re-launch installer for an already-downloaded APK
 *  - hasDownloaded(filename)        – true when a cached APK is ready to install
 *  - canInstall()                   – whether "install unknown apps" is granted
 *  - openInstallSettings()          – jump the user to "Install unknown apps"
 *
 * Progress + status events are dispatched back to the WebView as CustomEvents:
 *   'abiaconnect-apk-progress'              { loaded, total, speed }
 *   'abiaconnect-apk-installing'            { path, launched }
 *   'abiaconnect-apk-permission-required'   { path, filename }
 *   'abiaconnect-apk-error'                 { message }
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

    /** True when a previously-downloaded APK for `filename` is still on disk. */
    @JavascriptInterface
    public boolean hasDownloaded(String filename) {
        File f = apkFileFor(filename);
        return f != null && f.exists() && f.length() > 0;
    }

    /**
     * Re-launch the installer for an APK we already downloaded — used when
     * the user dismissed the install prompt, denied "install unknown apps",
     * or just wants to retry without paying the download cost again.
     * Silently no-ops (with an error event) when the cached file is gone.
     */
    @JavascriptInterface
    public void installExisting(String filename) {
        File f = apkFileFor(filename);
        if (f == null || !f.exists() || f.length() <= 0) {
            dispatchError("Downloaded update is no longer available. Please download again.");
            return;
        }
        launchInstaller(f);
    }

    @JavascriptInterface
    public void installFromUrl(final String url, final String filename) {
        if (url == null || url.isEmpty()) return;
        if (worker != null && worker.isAlive()) return;

        // Fast-path: if we already have this exact APK on disk, skip the network
        // and jump straight to install. This is what lets the user "retry install"
        // (or dismiss the system prompt and open it again) without re-downloading.
        File cached = apkFileFor(filename);
        if (cached != null && cached.exists() && cached.length() > 0) {
            long size = cached.length();
            // Emit a synthetic progress-complete so the UI can update its bar.
            dispatchProgress(size, size, 0);
            launchInstaller(cached);
            return;
        }

        worker = new Thread(() -> {
            HttpURLConnection conn = null;
            InputStream in = null;
            FileOutputStream out = null;
            File outFile = null;
            try {
                File dir = updatesDir();
                if (dir == null) {
                    dispatchError("Could not access update storage.");
                    return;
                }

                String safeName = filename == null || filename.isEmpty() ? "update.apk" : filename;
                outFile = new File(dir, safeName);

                // Prune stale APKs (previous versions) but keep the one we're
                // about to write so a partial retry can reuse it.
                File[] existing = dir.listFiles();
                if (existing != null) {
                    for (File f : existing) {
                        if (!f.getName().equals(safeName)) {
                            //noinspection ResultOfMethodCallIgnored
                            f.delete();
                        }
                    }
                }

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

    private File updatesDir() {
        File dir = new File(activity.getExternalFilesDir(null), "updates");
        if (!dir.exists() && !dir.mkdirs()) return null;
        return dir;
    }

    private File apkFileFor(String filename) {
        if (filename == null || filename.isEmpty()) return null;
        File dir = updatesDir();
        if (dir == null) return null;
        return new File(dir, filename);
    }

    private void launchInstaller(File apk) {
        activity.runOnUiThread(() -> {
            try {
                // Android 8+: requires user to grant "install unknown apps" first.
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    && !activity.getPackageManager().canRequestPackageInstalls()) {
                    // Distinct event so the UI can prompt for permission AND
                    // keep an "Install now" retry action pointed at the cached APK.
                    dispatchPermissionRequired(apk);
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

    private void dispatchPermissionRequired(File apk) {
        emit("abiaconnect-apk-permission-required",
            "{\"path\":" + JSONObject.quote(apk.getAbsolutePath())
                + ",\"filename\":" + JSONObject.quote(apk.getName()) + "}");
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
