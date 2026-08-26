# 日历任务管理

个人日历任务管理应用，支持四种任务类型（日常任务、周期任务、复习任务、持续进度任务）和三种视图模式（月/周/日）。数据存储在浏览器 localStorage 中，纯客户端运行。

## 环境要求

- **Node.js** ≥ 18（推荐 20+）
- **pnpm** ≥ 9

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动应用（自动构建 + 打开浏览器）
pnpm dev
```

启动后浏览器会自动打开 `http://localhost:3000`。如果没有自动打开，手动访问即可。

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 构建静态文件 + 启动服务器 + 打开浏览器 |
| `pnpm build` | 仅构建静态文件（输出到 `out/`） |
| `pnpm dev:next` | Next.js 开发模式（Turbopack 热更新，适合 UI 开发） |
| `pnpm lint` | 运行 ESLint（当前未安装 ESLint，命令无法正常运行） |

## 技术栈

Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui

## 项目结构

```
lib/              # 核心逻辑（任务引擎、日期工具、类型定义）
components/       # UI 组件（日历视图、任务表单、对话框）
scripts/serve.mjs # 轻量静态服务器（支持 Windows / macOS / Linux）
out/              # 构建产物（pnpm build 生成）
docs/             # 详细文档
```
