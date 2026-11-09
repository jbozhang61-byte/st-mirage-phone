package com.mirage.phone;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

import java.io.File;
import java.io.FileOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private WebView web;
    private static final String CRASH_FILE = "mp-crash.txt";

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);

        final Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            try {
                StringWriter buffer = new StringWriter();
                error.printStackTrace(new PrintWriter(buffer));
                FileOutputStream out = openFileOutput(CRASH_FILE, MODE_PRIVATE);
                out.write(buffer.toString().getBytes(StandardCharsets.UTF_8));
                out.close();
            } catch (Throwable ignored) { }
            if (previous != null) previous.uncaughtException(thread, error);
        });

        FrameLayout root = new FrameLayout(this);
        TextView report = new TextView(this);
        report.setTextSize(12f);
        report.setPadding(24, 90, 24, 24);

        try {
            File crash = new File(getFilesDir(), CRASH_FILE);
            if (crash.exists()) {
                byte[] data = new byte[(int) crash.length()];
                java.io.FileInputStream in = new java.io.FileInputStream(crash);
                in.read(data);
                in.close();
                report.setText(new String(data, StandardCharsets.UTF_8));
                root.addView(report);
                setContentView(root);
                return;
            }
        } catch (Throwable ignored) { }

        try {
            web = new WebView(this);
            WebSettings s = web.getSettings();
            s.setJavaScriptEnabled(true);
            s.setDomStorageEnabled(true);
            s.setAllowFileAccess(true);
            s.setAllowContentAccess(true);
            s.setAllowFileAccessFromFileURLs(true);
            s.setAllowUniversalAccessFromFileURLs(true);
            s.setMediaPlaybackRequiresUserGesture(false);
            web.setWebViewClient(new WebViewClient());
            web.loadUrl("file:///android_asset/www/preview/index.html");
            root.addView(web);
        } catch (Throwable error) {
            StringWriter buffer = new StringWriter();
            error.printStackTrace(new PrintWriter(buffer));
            report.setText("启动失败：\n" + buffer);
            root.addView(report);
        }
        setContentView(root);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
