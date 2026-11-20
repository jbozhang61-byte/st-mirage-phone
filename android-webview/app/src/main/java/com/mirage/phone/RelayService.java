package com.mirage.phone;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

/** 常驻中继服务：App 退到后台也继续开着 ws://127.0.0.1:17650。 */
public class RelayService extends Service {
    private static final String CHANNEL_ID = "mirage_relay";
    private static final int NOTI_ID = 1001;

    @Override
    public void onCreate() {
        super.onCreate();
        LocalRelay.start();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID, "幻镜手机中继", NotificationManager.IMPORTANCE_MIN);
                channel.setShowBadge(false);
                manager.createNotificationChannel(channel);
                Notification notification = new Notification.Builder(this, CHANNEL_ID)
                        .setContentTitle("幻镜手机")
                        .setContentText("中继运行中 · 酒馆可随时连接")
                        .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
                        .setOngoing(true)
                        .build();
                startForeground(NOTI_ID, notification);
            }
        } catch (Throwable ignored) { }
        LocalRelay.start();
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
