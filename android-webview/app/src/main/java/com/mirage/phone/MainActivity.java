package com.mirage.phone;

import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

public class MainActivity extends Activity {
    private WebView web;
    private TextView launchBtn;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);
        goFullscreen();

        FrameLayout root = new FrameLayout(this);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setUserAgentString(s.getUserAgentString() + " MiragePhone/1.0");
        web.setWebViewClient(new WebViewClient());
        web.setBackgroundColor(0xFF0B0C10);
        web.loadUrl("file:///android_asset/www/preview/index.html");

        // 左下角小按钮：一键启动酒馆 + 中继（走 Termux 的 RUN_COMMAND）
        launchBtn = new TextView(this);
        launchBtn.setText("启动酒馆");
        launchBtn.setTextSize(12f);
        launchBtn.setTextColor(0xFFFFFFFF);
        launchBtn.setBackgroundColor(0xCC2B5278);
        launchBtn.setPadding(28, 14, 28, 14);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT);
        lp.gravity = Gravity.BOTTOM | Gravity.START;
        lp.leftMargin = 18;
        lp.bottomMargin = 26;
        launchBtn.setLayoutParams(lp);
        launchBtn.setOnClickListener(v -> runTermuxScript());

        root.addView(web);
        root.addView(launchBtn);
        setContentView(root);
    }

    private void runTermuxScript() {
        Intent intent = new Intent();
        intent.setClassName("com.termux", "com.termux.app.RunCommandService");
        intent.setAction("com.termux.RUN_COMMAND");
        intent.putExtra("com.termux.RUN_COMMAND_PATH", "/data/data/com.termux/files/usr/bin/bash");
        intent.putExtra("com.termux.RUN_COMMAND_ARGUMENTS", new String[]{"/data/data/com.termux/files/home/mp.sh"});
        intent.putExtra("com.termux.RUN_COMMAND_WORKDIR", "/data/data/com.termux/files/home");
        intent.putExtra("com.termux.RUN_COMMAND_BACKGROUND", true);
        try {
            startService(intent);
            launchBtn.setText("已启动");
            launchBtn.postDelayed(() -> launchBtn.setText("启动酒馆"), 4000);
        } catch (Exception e) {
            launchBtn.setText("Termux 未授权");
        }
    }

    private void goFullscreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
