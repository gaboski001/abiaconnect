package com.abiaconnect.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;

/**
 * Rings with the phone's own ringtone (and vibrates) for a call that arrives
 * while the app is open, like a normal phone call. Follows the phone's
 * silent / vibrate switch.
 */
final class CallRinger {
    private static Ringtone ringtone;
    private static Vibrator vibrator;
    private static int generation = 0;

    private CallRinger() {}

    static synchronized void start(Context ctx) {
        stop();
        final int mine = ++generation;
        try {
            AudioManager am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
            int ringerMode = am != null ? am.getRingerMode() : AudioManager.RINGER_MODE_NORMAL;
            if (ringerMode == AudioManager.RINGER_MODE_NORMAL) {
                Uri uri = RingtoneManager.getActualDefaultRingtoneUri(ctx, RingtoneManager.TYPE_RINGTONE);
                if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                ringtone = RingtoneManager.getRingtone(ctx, uri);
                if (ringtone != null) {
                    ringtone.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) ringtone.setLooping(true);
                    ringtone.play();
                }
            }
            if (ringerMode != AudioManager.RINGER_MODE_SILENT) {
                vibrator = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
                if (vibrator != null && vibrator.hasVibrator()) {
                    long[] pattern = {0, 800, 600, 800, 1400};
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                    } else {
                        vibrator.vibrate(pattern, 0);
                    }
                }
            }
        } catch (Exception ignored) {
            // Never break the call over the ringtone.
        }
        // Safety stop: a call never rings longer than this.
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
            synchronized (CallRinger.class) {
                if (generation == mine) stop();
            }
        }, 45_000L);
    }

    static synchronized void stop() {
        try { if (ringtone != null) ringtone.stop(); } catch (Exception ignored) {}
        ringtone = null;
        try { if (vibrator != null) vibrator.cancel(); } catch (Exception ignored) {}
        vibrator = null;
    }
}
