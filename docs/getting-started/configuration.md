# 详细配置说明

## Next.js 配置 (`next.config.mjs`)

```js
const nextConfig = {
  output: 'export',         // 静态导出（纯 HTML/CSS/JS，无需 Node 服务器）
  typescript: {
    ignoreBuildErrors: true, // 构建时忽略 TS 类型错误
  },
  images: {
    unoptimized: true,       // 静态导出不支持 Next.js 图片优化
  },
  trailingSlash: true,       // URL 末尾带 /
}
```

## TypeScript 配置 (`tsconfig.json`)

- **strict 模式** 开启
- **路径别名** `@/*` → 项目根目录
- **target**: ES2017
- **module**: ESNext + bundler 解析

## Tailwind CSS 配置

Tailwind v4 使用 CSS 文件内 `@theme inline` 标记定义自定义属性，状态颜色通过 CSS 变量定义：

```css
--status-single: #06b6d4;
--status-recurring: #3b82f6;
--status-ebbinghaus: #a855f7;
--status-progress: #f59e0b;
--status-completed: #22c55e;
--status-missed: #ef4444;
--status-skipped: #eab308;
```

## shadcn/ui 配置 (`components.json`)

- **style**: `base-nova`
- **路径别名**: `@/` → 项目根目录
- **组件目录**: `components/ui/`

## 环境变量

项目不使用环境变量（纯客户端，无敏感配置）。以下文件已加入 `.gitignore`：

- `.env`
- `.env.local`
- `.env.development.local`
- `.env.test.local`
- `.env.production.local`

## PWA 配置

- `public/manifest.json` — PWA 清单（应用名「日程安排」）
- `public/sw.js` — 最小 Service Worker（仅提供"添加到 Dock"安装能力，无离线缓存）

## 静态资源

所有静态文件（图标、favicon 等）位于 `public/` 目录，构建时直接复制到 `out/`。
