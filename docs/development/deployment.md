# 部署流程

> ⚠️ **占位文件 — 当前无正式部署管线**

当前项目为个人本地使用，无 CI/CD 管线或生产部署配置。

## 当前构建方式

```bash
pnpm build          # 构建静态文件到 out/
pnpm dev            # 启动本地静态服务器 (localhost:3000)
```

`pnpm build` 执行 `next build`，输出到 `out/` 目录（纯 HTML/CSS/JS）。

## 静态文件服务器

`scripts/serve.mjs` 提供本地 HTTP 服务：
- 端口 3000
- 自动打开浏览器
- 端口冲突自动处理（健康检测、僵尸进程清理）

## 可能的部署方式

由于 `out/` 目录为纯静态文件，可部署到任何静态托管服务：

- **GitHub Pages** — 将 `out/` 推送到 `gh-pages` 分支
- **Vercel** — 直接部署 Next.js 项目（需移除 `output: 'export'`）
- **Netlify** — 上传 `out/` 目录
- **本地使用** — 直接打开 `out/index.html`（部分功能可能需 HTTP 服务）

## Tauri 迁移

参见 CLAUDE.md 中的「迁移到 Tauri 的路线图」。Tauri 迁移后部署方式变为独立的 `.app` 桌面应用，双击即用。
