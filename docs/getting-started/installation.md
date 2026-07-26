# 安装与配置指南

## 环境要求

| 工具 | 最低版本 | 推荐版本 |
|------|---------|---------|
| Node.js | 18.x | 最新 LTS |
| pnpm | 8.x | 最新稳定版 |

## 安装步骤

### 1. 克隆仓库

```bash
git clone <仓库地址>
cd mac_calender
```

### 2. 安装依赖

```bash
pnpm install
```

主要依赖包括：

- **Next.js 16** — 框架（Static Export 模式）
- **React 19** — UI 库
- **Tailwind CSS 4** — 样式框架
- **shadcn/ui** — 组件库
- **lucide-react** — 图标

完整清单见 `package.json`。

### 3. 验证安装

```bash
pnpm build        # 构建静态文件到 out/
pnpm dev          # 启动本地服务
```

## 常见安装问题

### pnpm 未安装

```bash
npm install -g pnpm
```

### 端口 3000 被占用

`pnpm dev` 的启动脚本（`scripts/serve.mjs`）会自动处理：
- 端口空闲 → 直接启动
- 已被健康服务器占用 → 复用，不重复启动
- 被僵尸进程占用 → 自动杀进程后重启

无需手动处理端口冲突。

### 构建失败（TypeScript 错误）

项目配置了 `typescript.ignoreBuildErrors: true`，TypeScript 类型错误不会阻止构建。如遇其他构建错误，检查 `out/` 目录权限。

## 开发模式

如需热更新开发体验（Next.js Turbopack）：

```bash
pnpm dev:next
```

此模式适合频繁修改代码时使用，修改会实时反映到浏览器。
