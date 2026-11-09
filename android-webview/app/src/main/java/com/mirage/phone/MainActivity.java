package com.mirage.phone;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.Gravity;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        FrameLayout root = new FrameLayout(this);
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
            TextView fallback = new TextView(this);
            fallback.setText("启动失败：\n" + error);
            fallback.setTextSize(13f);
            fallback.setPadding(32, 120, 32, 32);
            root.addView(fallback);
        }

        // 只有装了 Termux 才显示启动按钮，且点坏了也只提示，不影响 App
        try {
            getPackageManager().getPackageInfo("com.termux", 0);
            TextView btn = new TextView(this);
            btn.setText("启动酒馆");
            btn.setTextSize(12f);
            btn.setTextColor(0xFFFFFFFF);
            btn.setBackgroundColor(0xCC2B5278);
            btn.setPadding(26, 12, 26, 12);
            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT);
            lp.gravity = Gravity.BOTTOM | Gravity.START;
            lp.leftMargin = 16;
            lp.bottomMargin = 22;
            btn.setLayoutParams(lp);
            btn.setOnClickListener(v -> {
                try {
                    Intent intent = new Intent();
                    intent.setClassName("com.termux", "com.termux.app.RunCommandService");
                    intent.setAction("com.termux.RUN_COMMAND");
                    intent.putExtra("com.termux.RUN_COMMAND_PATH", "/data/data/com.termux/files/usr/bin/bash");
                    intent.putExtra("com.termux.RUN_COMMAND_ARGUMENTS", new String[]{"/data/data/com.termux/files/home/mp.sh"});
                    intent.putExtra("com.termux.RUN_COMMAND_WORKDIR", "/data/data/com.termux/files/home");
                    intent.putExtra("com.termux.RUN_COMMAND_BACKGROUND", true);
                    startService(intent);
                    btn.setText("已启动");
                } catch (Throwable error) {
                    btn.setText("请在 Termux 里开 allow-external-apps");
                }
            });
            root.addView(btn);
        } catch (Throwable ignored) { }

        // 内置中继：ws://127.0.0.1:17650，不需要 Python
        try {
            LocalRelay.start();
            TextView status = new TextView(this);
            status.setTextSize(10f);
            status.setTextColor(0x99FFFFFF);
            status.setPadding(26, 6, 26, 6);
            FrameLayout.LayoutParams sp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT);
            sp.gravity = Gravity.TOP | Gravity.START;
            sp.leftMargin = 16;
            sp.topMargin = 10;
            status.setLayoutParams(sp);
            root.addView(status);
            final TextView statusRef = status;
            status.postDelayed(new Runnable() {
                @Override
                public void run() {
                    statusRef.setText("中继 " + (LocalRelay.isRunning() ? "已开" : "未开") + " · " + LocalRelay.clientCount() + " 连接");
                    statusRef.postDelayed(this, 3000);
                }
            }, 1000);
        } catch (Throwable ignored) { }

        setContentView(root);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
