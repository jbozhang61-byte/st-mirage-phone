# 安装与平台

## 前置

- SillyTavern 1.13.0+，推荐 1.18.0
- 一个可用的文字模型（酒馆里已经能正常聊天）
- 想用 AI 配图的话，再准备一个生图接口（可选）

## 仓库地址

```text
https://github.com/jbozhang61-byte/st-mirage-phone
```

酒馆扩展安装页填这个地址，或直接克隆到扩展目录。仓库目前是私有的，需要先获得访问权限。

## Windows / macOS / Linux

把仓库放进：

```text
SillyTavern/data/<用户名>/extensions/third-party/st-mirage-phone/
```

刷新酒馆，右下角出现手机图标。

## Android

Android 上一般通过 Termux 跑 SillyTavern：

1. 在 Termux 里启动酒馆，手机浏览器打开 `http://127.0.0.1:8000`
2. 扩展目录同样是 `data/<用户名>/extensions/third-party/`
3. 手机上手机界面会自动铺满屏幕；也可在 设置 → 手机 里打开「手机端用悬浮窗」

## HarmonyOS

鸿蒙浏览器 / WebView 直接打开酒馆地址即可，交互和 Android 一致。
如果系统浏览器限制下载或文件选择，图片上传可能不可用，其余功能不受影响。

## iOS / iPadOS

Safari 打开酒馆页面；支持安全区和触摸。上传照片走系统相册。

## 更新

- Git 安装：在扩展页面点更新，或 `git pull`
- 手动安装：覆盖目录后强刷页面（Ctrl+Shift+R）

## 卸载

删除扩展目录，或在酒馆扩展页面卸载。聊天里的手机数据随对应聊天保存，不会自动删除。