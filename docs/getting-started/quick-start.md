# 5 分钟快速上手

## 前提条件

- Node.js ≥ 18（推荐使用最新 LTS 版本）
- pnpm（推荐通过 `npm install -g pnpm` 安装）

## 步骤

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动应用

```bash
pnpm dev
```

浏览器会自动打开 `http://localhost:3000`。

### 3. 开始使用

应用首次启动时为空状态，没有任何预加载数据。你可以：

- 点击右上角 **"+ 新建任务"** 创建第一个任务
- 通过月/周/日三种视图浏览和管理任务
- 点击任务卡片左侧圆圈标记完成

### 4. 添加测试数据（可选）

打开浏览器控制台（F12），粘贴测试数据脚本并回车执行，页面自动刷新后即可看到数据。

### 5. 停止服务

```bash
pkill -f "scripts/serve"
```

## 下一步

- 了解[详细安装配置](installation.md)
- 阅读[基础操作指南](../user-guide/basic-workflows.md)
- 查看[架构概览](../architecture/overview.md)
