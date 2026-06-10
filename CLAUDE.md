# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作提供指导。

## 常用命令

```bash
pnpm dev        # 启动 Next.js 开发服务器 (localhost:3000)
pnpm build      # 生产构建
pnpm start      # 启动生产服务器
pnpm lint       # 运行 ESLint
```

未配置测试框架。应用纯客户端运行，无 API 路由。

## 项目概述

个人日历任务管理应用（中文界面），支持三种任务类型和三种视图模式（月/周/日）。所有状态存储在 `localStorage` 中——无后端、无数据库。

### 技术栈

- **Next.js 16** (App Router), **React 19**, **TypeScript 5.7**
- **Tailwind CSS 4** + `tw-animate-css` + shadcn/ui 组件（位于 `components/ui/`）
- `@base-ui/react` 用于无障碍原语（Select, RadioGroup, Switch）
- `lucide-react` 图标库
- 路径别名：`@/` 映射到项目根目录

## 架构

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

- **`use-app-state.ts`** — React 钩子：任务/假期的 CRUD 操作、`completeInstance`/`uncompleteInstance`、`togglePause`、假期模式开关。首次加载时填充示例数据。持久化到 `localStorage`，键为 `calendar-scheduler-state-v1`。

- **`status-visuals.ts`** — 无状态辅助函数，将 `InstanceStatus`/`TaskType` 映射为 CSS 变量颜色、标签和不透明度规则。

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

1. `useAppState()` 提供状态和变更方法
2. `calendar-app.tsx` 调用 `buildInstanceMap(tasks, activeHolidays, rangeStart, rangeEnd, today)`，范围由 useMemo 缓存
3. 实例映射传递给视图组件进行渲染
4. 用户交互（完成/撤销完成、创建/编辑/删除任务、暂停切换）通过 `completeInstance`/`addTask` 等回调到 `useAppState`
5. 状态变化触发重新渲染并自动持久化到 localStorage

### 假期模式

当 `holidayModeEnabled` 为 true 时，`activeHolidays` 非空，进度任务在假期期间跳过实例生成，截止日自动顺延。周期任务和艾宾浩斯复习不受影响。

## 约定

- 所有日期使用 `DateKey` 字符串（`YYYY-MM-DD`），状态中绝不使用 `Date` 对象
- 组件使用 `'use client'` —— 本应用 100% 客户端运行
- CSS 使用 Tailwind v4 的 `@theme inline` 标记和 CSS 自定义属性（`--status-recurring`、`--status-completed` 等）表示状态颜色
- 导入使用 `@/` 路径别名
- 任务类型判别使用 `===` 比较（如 `task.type === 'recurring'`）
