# 贡献指南

谢谢愿意帮这个项目。它是纯前端的 SillyTavern 扩展，没有构建步骤。

## 开发

```bash
npm run serve   # 预览环境，改前端后刷新即可
npm test        # 单元测试
node tools/audit.mjs   # 检查 import 是否都能解析
```

预览环境不需要酒馆：`preview/boot.js` 会伪造 `SillyTavern.getContext()`。

## 代码约定

- 原生 ES module，不引入框架
- 每个 App 一个文件，放在 `src/apps/`，只负责自己的界面
- 数据读写走 `src/store.js`，不要直接改 `chatMetadata`
- 提示词与解析放在 `src/prompts.js` 或 `src/feed.js`，纯函数，能写测试就写
- 样式按模块追加到 `css/`，不要覆盖别家扩展的全局样式

## 提交

- 一个提交做一件事
- 修改 UI 请附截图
- 改了提示词/解析请补测试
- 不要提交 `shots/`、`.chrome-*`、日志

## 新增一个 App

1. `src/app-meta.js` 加一条目录
2. `src/apps/your-app.js` 导出 `mountXxx(host, { nav })`
3. `src/phone.js` 的 `APPS` 注册
4. 需要内容生成就在 `src/ai.js` 加函数，并在 `src/feed.js` / `src/social.js` 加配方
5. 补样式和预览入口
