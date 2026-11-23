package com.abiaconnect.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.text.TextUtils;

import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * The round picture shown on the incoming-call and in-call notifications:
 * the caller's profile photo, or their first letter on the brand colour
 * (like WhatsApp), never the app's status-bar mark.
 */
final class CallAvatar {
    private static final int SIZE = 192;

    private CallAvatar() {}

    /** Photo when it downloads within a few seconds, otherwise the letter picture. */
    static Bitmap forCaller(Context ctx, String name, @Nullable String photoUrl) {
        Bitmap photo = download(photoUrl);
        return photo != null ? circle(photo) : initial(ctx, name);
    }

    static Bitmap initial(Context ctx, String name) {
        Bitmap out = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(out);
        Paint bg = new Paint(Paint.ANTI_ALIAS_FLAG);
        bg.setColor(ContextCompat.getColor(ctx, R.color.notification_color));
        c.drawCircle(SIZE / 2f, SIZE / 2f, SIZE / 2f, bg);

        String letter = "?";
        String trimmed = name == null ? "" : name.trim();
        if (!trimmed.isEmpty()) letter = new String(Character.toChars(trimmed.codePointAt(0))).toUpperCase();
        Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
        text.setColor(0xFFFFFFFF);
        text.setTextSize(SIZE * 0.45f);
        text.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        text.setTextAlign(Paint.Align.CENTER);
        Rect bounds = new Rect();
        text.getTextBounds(letter, 0, letter.length(), bounds);
        c.drawText(letter, SIZE / 2f, SIZE / 2f + bounds.height() / 2f, text);
        return out;
    }

    @Nullable
    private static Bitmap download(@Nullable String url) {
        if (TextUtils.isEmpty(url) || !url.startsWith("https://")) return null;
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setConnectTimeout(2500);
            conn.setReadTimeout(2500);
            conn.setInstanceFollowRedirects(true);
            if (conn.getResponseCode() != 200) return null;
            if (conn.getContentLength() > 5_000_000) return null;
            try (InputStream in = conn.getInputStream()) {
                BitmapFactory.Options o = new BitmapFactory.Options();
                o.inPreferredConfig = Bitmap.Config.ARGB_8888;
                return BitmapFactory.decodeStream(in, null, o);
            }
        } catch (Exception | OutOfMemoryError e) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static Bitmap circle(Bitmap src) {
        int side = Math.min(src.getWidth(), src.getHeight());
        Bitmap square = Bitmap.createBitmap(src, (src.getWidth() - side) / 2, (src.getHeight() - side) / 2, side, side);
        Bitmap scaled = Bitmap.createScaledBitmap(square, SIZE, SIZE, true);
        Bitmap out = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setShader(new BitmapShader(scaled, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP));
        new Canvas(out).drawCircle(SIZE / 2f, SIZE / 2f, SIZE / 2f, p);
        return out;
    }
}
