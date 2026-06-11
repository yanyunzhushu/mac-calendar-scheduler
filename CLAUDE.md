# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作提供指导。

## 常用命令

```bash
pnpm dev        # 启动静态服务器 (localhost:3000) + 自动打开浏览器
pnpm build      # 构建静态导出（output: export，输出到 out/）
pnpm dev:next   # 开发模式（Next.js Turbopack 热更新）
pnpm lint       # 运行 ESLint
pkill -f "scripts/serve"  # 手动停止服务器
```

> **注意**：首次运行 `pnpm install` 后，需要在 `package.json` 中配置：
> ```json
> "pnpm": { "onlyBuiltDependencies": ["better-sqlite3"] }
> ```
> 然后 `pnpm approve-builds better-sqlite3`，否则 `better-sqlite3` 不会编译。

未配置测试框架。应用纯客户端运行，无需后端服务。

## 项目概述

个人日历任务管理应用（中文界面），支持三种任务类型和三种视图模式（月/周/日）。数据存储在浏览器 localStorage 中。

**启动**：终端运行 `pnpm dev` → 自动打开浏览器。
- 服务器约 1 秒就绪，再次运行直接复用已有服务器。
- 如需手动停止：`pkill -f "scripts/serve"`

### 技术栈

- **Next.js 16** + **static export**（`output: 'export'`，纯静态站点）
- **React 19**, **TypeScript 5.7**
- **Tailwind CSS 4** + `tw-animate-css` + shadcn/ui 组件（位于 `components/ui/`）
- **数据持久化**：浏览器 `localStorage`
- `@base-ui/react` 用于无障碍原语（Select, RadioGroup, Switch）
- `lucide-react` 图标库
- **PWA 支持**：`manifest.json` + `sw.js`（未做离线缓存，仅提供"添加到 Dock"安装能力）
- 路径别名：`@/` 映射到项目根目录

## 架构

> **架构说明（2026-06-11 更新）**：应用已改为纯客户端应用。
> 所有数据存储在浏览器 localStorage 中，无服务器端依赖。
> 使用 `output: 'export'` 预编译为纯静态文件，`scripts/serve.mjs` 提供轻量 HTTP 服务。

### 状态层 (`lib/`)

- **`types.ts`** — 任务类型层次结构（按 `type` 区分的联合类型）：
  - `RecurringTask`（周期任务）— 按每天/每周/每月/自定义间隔重复，可设结束条件
  - `EbbinghausTask`（艾宾浩斯复习）— 按可配置的天数间隔序列进行间隔重复
  - `ProgressTask`（持续进度）— 滚动截止日：每次完成后截止日向前推进 N 天
  - `Holiday` — 假期区间，持续进度任务在此期间暂停（截止日自动顺延）
  - `TaskInstance` — 任务在特定日期的已解析实例，包含计算得出的 `InstanceStatus`（待完成/已完成/已错过/未来/假期暂停）
  - `AppState` — 完整持久化状态结构（`tasks[]`, `holidays[]`, `holidayModeEnabled`）

- **`date-utils.ts`** — 所有日期使用 `"YYYY-MM-DD"` 字符串键（`DateKey`）。纯函数工具：`toKey`/`fromKey`、`addDays`、`diffDays`、`compareKey`、`getMonthGrid`（月视图 6×7 网格）、`getWeekDays`（周日起始周）、`formatMonthTitle`/`formatLong` 等。

- **`task-engine.ts`** — 纯函数，无 React。核心逻辑：
  - `generateRecurringInstances()` — 按 `freq`/`interval` 从 `startDate` 开始遍历，遵守结束条件，在范围内生成实例
  - `generateEbbinghausInstances()` — 每个间隔序列项生成一个实例，可选受结束条件限制
  - `generateProgressInstances()` — 模拟滚动截止日：每次完成将下一个截止日向前推进；`computeProgressCycles()` 重建完整时间线
  - `buildInstanceMap()` — 主要入口：给定任务+假期+范围，返回 `Record<DateKey, TaskInstance[]>`
  - 假期感知：`findHoliday()` / `adjustForHoliday()` — 进度任务的截止日自动顺延过假期

- **`use-app-state.ts`** — React 钩子：
  - 所有数据持久化到浏览器 `localStorage`，键名为 `calendar-app-state`
  - 初始化时同步加载 localStorage 数据（首次使用自动填充 5 个示例任务）
  - 每次状态变化自动保存到 localStorage
  - `createId()` 生成短 ID（`Math.random` + `Date.now` 混合）

- **`use-app-state.ts`** — React 钩子：（见上方 `lib/` 章节）

- **`status-visuals.ts`** — 无状态辅助函数，将 `InstanceStatus`/`TaskType` 映射为 CSS 变量颜色、标签和不透明度规则。

### API 层 `app/api/` (已移除)

**2026-06-11 移除**：应用改为纯客户端，不再有后端 API 路由。数据直接读写浏览器 localStorage。

### UI 层 (`components/calendar/`)

- **`calendar-app.tsx`** — 根客户端组件。管理视图状态（`anchor`、`selected`、`view`），通过 `buildInstanceMap` 计算 `instanceMap`，并渲染布局：
  - `CalendarHeader` — 视图切换器（月/周/日）、导航箭头、"今天"按钮、假期对话框按钮、新建任务按钮
  - 视图面板（按条件渲染）：
    - `MonthView` — 7 列网格，每格用 `DotsRow` 显示任务状态圆点
    - `WeekView` — 7 列布局，每天显示任务名称标签
    - `DayView` — 全天任务列表，使用 `InstanceItem` 卡片
  - `DaySidebar` — 320px 右侧边栏，显示选中日期的任务（月/周视图下显示）
  - `TaskForm` — 模态对话框：创建/编辑任务，包含类型专属字段（重复频率、艾宾浩斯间隔序列、进度间隔、结束条件）
  - `HolidayDialog` — 模态对话框：管理假期日期区间 + 启用/禁用开关
  - `Legend` — 任务类型和状态的图例说明

### UI 组件库 (`components/ui/`)

预构建的 shadcn/ui 组件（Button、Dialog、Input、Select、Switch、Tabs、Badge、Label、Textarea、RadioGroup、ScrollArea）。这些是通用的非应用特定组件——除非添加新的 shadcn 组件，否则避免修改它们。

### 关键数据流

1. `useAppState()` 初始化时从 `localStorage` 加载全部数据（首次使用则填充 5 个示例任务）
2. `calendar-app.tsx` 调用 `buildInstanceMap(tasks, activeHolidays, rangeStart, rangeEnd, today)`，范围由 useMemo 缓存
3. 实例映射传递给视图组件进行渲染
4. 用户交互（完成/撤销完成、创建/编辑/删除任务、暂停切换）通过回调到 `useAppState`
5. `useAppState` 更新 React 状态，状态变化后自动持久化到 `localStorage`
6. 页面刷新时重新从 `localStorage` 加载

### 假期模式

当 `holidayModeEnabled` 为 true 时，`activeHolidays` 非空，进度任务在假期期间跳过实例生成，截止日自动顺延。周期任务和艾宾浩斯复习不受影响。

## 约定

- 所有日期使用 `DateKey` 字符串（`YYYY-MM-DD`），状态中绝不使用 `Date` 对象
- CSS 使用 Tailwind v4 的 `@theme inline` 标记和 CSS 自定义属性（`--status-recurring`、`--status-completed` 等）表示状态颜色
- 导入使用 `@/` 路径别名
- 任务类型判别使用 `===` 比较（如 `task.type === 'recurring'`）
- 后端 API 路由（`app/api/`）运行在 Node.js 环境中，不能使用 `'use client'` 或浏览器 API
- 前端组件（`components/`）使用 `'use client'`

## 迁移到 Tauri 的路线图

> 如果想保留现有 UI 和功能，仅将底层换成 Tauri（独立桌面应用），以下是需要调整的部分：

### 需要重写的文件

| 文件 | 原因 | 替换方案 |
|------|------|---------|
| `app/api/*` 全部路由 | Tauri 不用 HTTP API，而是通过 IPC 调用 Rust 函数 | 删除，改为 `src-tauri/src/commands.rs` 中的 `#[tauri::command]` |
| `lib/use-app-state.ts` 中的 `localStorage` 调用 | Tauri 前端用 `invoke()` 访问 Rust 数据层，而非浏览器 localStorage | 将 `localStorage` 替换为 `invoke()` 调用，或在 Rust 侧用 `tauri-plugin-store` 持久化 |
| `scripts/serve.mjs` + `next.config.mjs`（output: export） | Tauri 自带 WebView，不再需要静态文件服务器或 Next.js 构建 | 删除 `scripts/` 目录，移除 `next.config.mjs` 的 `output: 'export'` |
| **（无 `lib/db.ts`）** | 已移除，无需迁移 | — |

### 需要新增的文件

| 文件 | 作用 |
|------|------|
| `src-tauri/` | Tauri 项目目录（`tauri init` 自动生成） |
| `src-tauri/Cargo.toml` | Rust 依赖清单（加入 `rusqlite`、`serde`、`serde_json`） |
| `src-tauri/src/main.rs` | Tauri 入口，注册 `#[tauri::command]` |
| `src-tauri/src/commands.rs` | CRUD 函数实现（替代 `lib/db.ts`） |
| `src-tauri/src/db.rs` | SQLite 连接管理（`rusqlite::Connection` 替代 `better-sqlite3`） |
| `src-tauri/icons/` | Tauri 应用的图标资源 |
| `src-tauri/tauri.conf.json` | Tauri 配置（窗口尺寸、应用名、权限等） |

### 完全不变的文件（可原封不动复制）

| 文件 | 原因 |
|------|------|
| `lib/types.ts` | 纯 TypeScript 类型定义，与框架无关 |
| `lib/task-engine.ts` | 纯函数，不含 React/HTTP 代码 |
| `lib/date-utils.ts` | 纯函数日期工具 |
| `lib/status-visuals.ts` | 纯 UI 映射函数 |
| `components/calendar/*` | React 组件，仅调用 `useAppState()` 接口 |
| `components/ui/*` | shadcn 通用组件 |
| `app/globals.css` | CSS 全局样式 |

### 关键流程变化

```diff
- pnpm dev → Node.js 静态服务器启动 → 自动打开浏览器
+ 直接双击 Tauri .app → 弹出独立窗口（WebView 内渲染）

- 关浏览器 = 服务器仍在后台（需手动 pkill）
+ 关窗口 = 进程自动退出

- 发朋友需对方装 Node.js + pnpm + pnpm build
+ 直接给 .app，任何人双击即用
```

### 迁移步骤

```bash
pnpm add -D @tauri-apps/cli    # 安装 Tauri CLI
pnpm tauri init                 # 初始化 src-tauri/ 目录
# 然后：
# 1. 在 src-tauri/Cargo.toml 添加 rusqlite、serde 依赖
# 2. 用 Rust 重写 lib/db.ts → src-tauri/src/db.rs + commands.rs
# 3. 修改 use-app-state.ts：fetch → invoke
# 4. pnpm tauri dev（开发模式调试）
# 5. pnpm tauri build（打包发布）
```

### 存储位置变化

| 当前 | Tauri 后 |
|------|---------|
| 浏览器 `localStorage` | `~/Library/Application Support/com.calendar.app/calendar.db`（或 `tauri-plugin-store` 的 JSON 文件） |
