package com.mirage.phone;

import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
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
        // 沉浸式全屏：隐掉系统状态栏和导航栏，页面从屏幕最顶端开始
        try {
            getWindow().setFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsetsController controller = getWindow().getInsetsController();
                if (controller != null) {
                    controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                    controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
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
        } catch (Throwable ignored) { }

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
            // 让页面知道自己在 APK 里（触发 html.mp-native：隐藏自绘状态栏/灵动岛）
            s.setUserAgentString(s.getUserAgentString() + " MiragePhone/1.0");
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
        final WebView[] webRef = new WebView[]{web};
        try {
            LocalRelay.start();
            LocalRelay.onState = () -> {
                final String state = LocalRelay.lastState;
                final WebView target = webRef[0];
                if (state == null || target == null) return;
                runOnUiThread(() -> {
                    try {
                        target.evaluateJavascript(
                            "(function(){try{window.__mpBridgeState=" + state + ";"
                            + "window.dispatchEvent(new CustomEvent('mp-bridge',{detail:window.__mpBridgeState}));}catch(e){}})()",
                            null);
                    } catch (Throwable ignored) { }
                });
            };
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
                    boolean tavern = tavernAlive();
                    int linked = LocalRelay.clientCount();
                    String text = "中继 " + (LocalRelay.isRunning() ? "开" : "关")
                            + " · 酒馆 " + (tavern ? "已连" : "未开")
                            + " · " + linked + " 连接";
                    statusRef.setText(text);
                    // 酒馆没开时自动尝试拉起一次（装过 Termux 才做）
                    if (!tavern && !autoLaunchTried) {
                        autoLaunchTried = true;
                        fireTermuxLaunch();
                    }
                    statusRef.postDelayed(this, 4000);
                }
            }, 1200);
        } catch (Throwable ignored) { }

        setContentView(root);
    }

    private boolean autoLaunchTried = false;

    private boolean tavernAlive() {
        java.net.Socket socket = new java.net.Socket();
        try {
            socket.connect(new java.net.InetSocketAddress("127.0.0.1", 8000), 300);
            return true;
        } catch (Throwable error) {
            return false;
        } finally {
            try { socket.close(); } catch (Throwable ignored) { }
        }
    }

    private void fireTermuxLaunch() {
        try {
            getPackageManager().getPackageInfo("com.termux", 0);
            Intent intent = new Intent();
            intent.setClassName("com.termux", "com.termux.app.RunCommandService");
            intent.setAction("com.termux.RUN_COMMAND");
            intent.putExtra("com.termux.RUN_COMMAND_PATH", "/data/data/com.termux/files/usr/bin/bash");
            intent.putExtra("com.termux.RUN_COMMAND_ARGUMENTS", new String[]{"/data/data/com.termux/files/home/mp.sh"});
            intent.putExtra("com.termux.RUN_COMMAND_WORKDIR", "/data/data/com.termux/files/home");
            intent.putExtra("com.termux.RUN_COMMAND_BACKGROUND", true);
            startService(intent);
        } catch (Throwable ignored) { }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
