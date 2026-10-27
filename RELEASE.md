# 发布流程

这个仓库是 SillyTavern 扩展，没有构建产物；发布 = 打 tag + 写 Release 说明 + 上传 zip。

## 版本号

- 遵循 SemVer：`MAJOR.MINOR.PATCH`
- 新增 App / 大功能 → MINOR
- 修 bug / 样式 → PATCH
- 破坏数据结构（chatMetadata 不兼容）→ MAJOR，并在 CHANGELOG 写明迁移

需要同步改的地方：

1. `manifest.json` 的 `version`
2. `package.json` 的 `version`
3. `index.js` 的 `VERSION`
4. `CHANGELOG.md` 顶部新增一节
5. README 徽章里的版本号

## 发布前检查

```bash
npm test                 # 单元测试
node tools/audit.mjs     # import 审计
git status --porcelain   # 应该干净
```

手动检查：

- [ ] 预览里主屏、消息、商店、设置都能打开
- [ ] 新功能在窄屏（≤760px）下不溢出
- [ ] 手机打开时只有一个返回键
- [ ] AI 相关功能在失败时会提示，不会白屏
- [ ] 没有把测试数据写进用户聊天
- [ ] README 截图是最新的

## 打 tag

```bash
git add -A
git commit -m "release: 1.5.0"
git tag -a v1.5.0 -m "Mirage Phone 1.5.0"
git push origin main
git push origin v1.5.0
```

## 生成 zip

```bash
git archive --format=zip --prefix=st-mirage-phone/ -o st-mirage-phone-1.5.0.zip HEAD
```

不要把 `shots/`、`.git`、测试数据打进 zip。

## 建 Release（草稿）

```bash
gh release create v1.5.0 st-mirage-phone-1.5.0.zip \
  --title "幻镜手机 1.5.0" \
  --notes-file RELEASE_NOTES.md \
  --draft
```

- 先建 **draft**，检查说明和附件
- 公开、正式发布由仓库主人在 GitHub 页面点 **Publish release**

## Release 说明模板

```markdown
## 新增

- 

## 修复

- 

## 兼容性

- SillyTavern 1.13+
- Windows / macOS / Linux / Android / HarmonyOS / iOS
```

## 回滚

- 删除错误的 tag 和 Release，重新从上一个 tag 打补丁版本
- 不要 force-push `main`；用新提交回退

## 热修

1. 从 `main` 开分支修
2. 补测试
3. 合回 `main`，发 PATCH 版本
