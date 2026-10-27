# 发布到 GitHub

本地仓库已经初始化好：`main` 分支上有提交，也打了 `v1.0.0` 标签。
最后一步（建仓库、决定公开 / 私有）留给你。

## 一次性配置

```powershell
cd "D:\deep seek harness\st-mirage-phone"
git config user.name  "你的名字"
git config user.email "你的邮箱"
```

## 方式 A：网页建仓库，再推

1. 打开 <https://github.com/new>
2. 仓库名建议 `st-mirage-phone`，**不要**勾选 README / .gitignore / license（本地已经有了）
3. 建好后：

```powershell
git remote add origin https://github.com/<你的用户名>/st-mirage-phone.git
git push -u origin main --tags
```

HTTPS 推送会弹一次登录。GitHub 已经不接受密码，用 **Personal Access Token**
（Settings → Developer settings → Personal access tokens，勾 `repo`）当密码；或者改走 SSH：

```powershell
git remote set-url origin git@github.com:<你的用户名>/st-mirage-phone.git
```

本机已有 SSH key 的话，把 `~/.ssh/*.pub` 加到 GitHub → Settings → SSH keys 即可。

## 方式 B：装了 GitHub CLI 的话

```powershell
gh auth login
gh repo create st-mirage-phone --public --source . --remote origin --push
git push --tags
```

## 用仓库里的脚本

```powershell
.\tools\publish.ps1 -Repo "https://github.com/<你的用户名>/st-mirage-phone.git"
```

它只会做 `git remote add/set-url`、`git push` 和推标签，不会建仓库、不会改代码。

## 推送之后

1. 把 `manifest.json` 里的 `homePage` 改成刚建好的仓库地址（这样扩展列表里能点进去）。
2. 在 GitHub 仓库 → **Releases → Draft a new release**，选 `v1.0.0` 标签，把 `CHANGELOG.md` 里 1.0.0 那段贴进去。
3. 想被更多人看到，可以：
   - 在 README 顶部补一张 GIF / 视频（现在的截图已经够用）
   - 到酒馆的中文社区 / Discord 的 `extensions` 频道发帖
   - 如果要提交到第三方扩展索引，按那个索引的要求填 manifest 和仓库地址

## 建议再检查一遍

- [ ] 仓库是 public 还是 private（你决定）
- [ ] `manifest.json` 的版本号、作者、`homePage`
- [ ] README 里的截图路径是否正常显示
- [ ] 在真实酒馆里装一遍：扩展 → 安装扩展 → 粘贴仓库地址 → 刷新
- [ ] 用一张角色卡跑通：发消息、朋友圈、带进剧情、导入导出
