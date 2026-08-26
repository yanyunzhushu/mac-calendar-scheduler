# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作提供指导。读者默认对本项目一无所知。

## 项目概述

个人日历任务管理应用（中文界面，应用名「日程安排」），支持**四种任务类型**和三种视图模式（月/周/日）。纯客户端运行，所有数据存储在浏览器 `localStorage`（键名 `calendar-app-state`），无任何后端服务。

**启动**：终端运行 `pnpm dev` → 自动打开浏览器（localhost:3000）。

## 常用命令

```bash
pnpm dev        # 启动静态服务器 (localhost:3000) + 自动打开浏览器
pnpm build      # 构建静态导出（next build，output: export，输出到 out/）
pnpm dev:next   # 开发模式（Next.js Turbopack 热更新）
pkill -f "scripts/serve"  # 手动停止静态服务器
```

注意事项：

- `pnpm dev` 运行 `scripts/serve.mjs`：端口空闲则直接启动（约 1 秒就绪）；被健康服务器占用则复用并退出；被僵尸进程占用则杀掉重启；`out/` 不存在时自动先构建。设置 `CI` 或 `OPEN_BROWSER=false` 可禁止自动打开浏览器。
- `package.json` 中虽有 `pnpm lint` 脚本（`eslint .`），但 **ESLint 并未安装为依赖、仓库中也没有 ESLint 配置文件**，该命令当前无法正常运行。如需 lint 需先自行安装配置。
- **未配置任何测试框架**，没有测试目录和测试命令。验证方式为 `pnpm build` 构建 + 浏览器中手动确认。
- 仓库根目录的 `AGENTS.md` 与本文件内容同源（面向通用 AI 编码代理）；`graphify-out/` 是代码图谱分析产物，`_installed.md` 是本机工具安装记录，均与应用代码无关，不要误当作应用源码。

## 技术栈

- **Next.js 16** + **static export**（`output: 'export'`，纯静态站点；`next.config.mjs` 还设置了 `typescript.ignoreBuildErrors: true`、`images.unoptimized: true`、`trailingSlash: true`）
- **React 19**, **TypeScript 5.7**（strict 模式）
- **Tailwind CSS 4** + `tw-animate-css` + shadcn/ui 组件（位于 `components/ui/`，style 为 `base-nova`）
- **数据持久化**：浏览器 `localStorage`
- `@base-ui/react` 用于无障碍原语（Select, RadioGroup, Switch）
- `lucide-react` 图标库
- **PWA 支持**：`public/manifest.json` + `public/sw.js`（sw 为最小实现，仅注册自身以提供"添加到 Dock"安装能力，无离线缓存）
- `@vercel/analytics`：仅生产环境加载（`app/layout.tsx`）
- 路径别名：`@/` 映射到项目根目录（`tsconfig.json` 与 `components.json` 一致）

## 架构

应用为纯客户端架构：构建时 `next build` 预编译为静态文件到 `out/`，运行时由 `scripts/serve.mjs` 提供轻量 HTTP 服务。无 `app/api/` 目录（已于 2026-06 移除），无任何服务器端代码。

### 状态层 (`lib/`)

- **`types.ts`** — 任务类型层次结构（按 `type` 判别的联合类型 `Task`）：
  - `SingleTask`（日常任务）— 在指定 `date` 执行一次；支持 `countingMode`（计数模式：同日可多次完成并记录次数）
  - `RecurringTask`（周期任务）— 按 `freq`（每天/每周/每月/自定义间隔 `customDays` + `interval`）从 `startDate` 重复，可设 `end` 结束条件（永不/次数/日期）；支持 `countingMode`
  - `EbbinghausTask`（复习任务）— 按可配置的天数间隔序列进行间隔重复，默认 `0,1,2,4,7,15,30,60`；超出序列后以最后一个间隔循环；可设 `themeId`（学习主题）
  - `ProgressTask`（持续进度）— 累积进度条模型。支持**步骤列表**（`steps: ProgressStep[]`，每步有 `name` 和独立 `interval` 推进天数，按顺序循环）；`dailyCompletions: Record<DateKey, number>` 记录每日完成次数（支持同日多次链式完成）；`defaultInterval`（无步骤时的推进天数）；`startStepIndex`（起始步骤索引，创建后不可修改）
  - `Holiday` — 假期区间，假期模式开启时周期任务与持续进度任务在此期间隐藏（见下文「假期模式」）
  - `TaskInstance` — 任务在特定日期的已解析实例，含 `InstanceStatus`：`pending`（待完成）/ `completed` / `missed`（已错过）/ `future` / `holiday`（假期暂停）/ `skipped`（未做或已覆盖，仅进度任务）
  - `AppState` — 完整持久化状态：`tasks[]`、`holidays[]`、`holidayModeEnabled`、`groups[]`（任务分组，见下文）、`themes[]`（学习主题）、`trash[]`（回收站）
  - 导出 `TASK_TYPE_LABEL`（中文标签）和 `TASK_TYPE_COLOR`（各类型基础色）

- **`date-utils.ts`** — 所有日期使用 `"YYYY-MM-DD"` 字符串键（`DateKey`）。纯函数工具：`toKey`/`fromKey`/`todayKey`、`addDays`/`addMonths`、`diffDays`、`compareKey`、`isWithin`、`getMonthGrid`（月视图 6×7 网格）、`getWeekDays`（周日起始周）、`formatMonthTitle`/`formatLong` 等。

- **`task-engine.ts`** — 纯函数，无 React。核心逻辑：
  - `generateSingleInstances()` — 单日实例；计数模式下 `actionable` 在到期后持续为 true 且 `count` 展示次数
  - `generateRecurringInstances()` — 从 `startDate` 按频率遍历，遵守结束条件；不生成今天之后的实例（若 `startDate` 在未来，则仅在该日期落在视图范围内时显示一个灰色的 `future` 标记）；`paused` 任务同样遵守此限制
  - `generateEbbinghausInstances()` — 每个间隔序列项生成一个实例，`meta` 为"第 N 次复习"
  - `generateProgressInstances()` — 进度任务实例模型（与旧文档描述的"滚动截止日"不同，以代码为准）：
    - 仅生成 `startDate` 到**今天**的实例（未来日"隐形"；若 `startDate` 在未来则只显示起始日）
    - 当日有完成记录 → 一个合并的已完成实例（`count` 为次数；有步骤时 `meta` 为步骤链，如"步骤A → 步骤B ✓"，同日同步折叠为"×N"；今天的实例会追加"· 下一步: 步骤名"）
    - 当日无完成记录 → 按位置判定：两段完成记录之间且进度条已覆盖 → `skipped`/"已覆盖"；跳过区间内未覆盖 → `skipped`/"未做"；超出覆盖范围的过去日 → `missed`（可补做）；今天 → `pending`（可完成，任务名显示为 `"任务名 (步骤名)"`）
    - **`skipped`（已覆盖/未做）仅适用于过去日**：今天（未暂停、非假期）恒为 `pending` 且可操作，与进度条是否已覆盖无关——`barEnd` 超过今天只表示提前量，不阻断当天完成（见 2026-07 修复）
    - `computeProgressBarEnd()` — 进度条覆盖终点：从 `startDate` 起累计 `已完成步骤累计天数` 个有效日（非假期日），遇到假期自动跳过，`startDate` 本身始终算作第 1 天；`startStepIndex` 不产生预填进度。注意：该函数基于当前 `steps.interval` 与 `startDate` 实时重算，修改推进天数或起始日期都会追溯影响历史覆盖范围
    - 假期感知：`findHoliday()`；今天处于假期时实例为 `holiday` 状态
    - `paused` 任务今天显示 `holiday` 状态，不可操作
  - `buildInstanceMap()` — 主入口：给定任务+假期+范围，返回 `Record<DateKey, TaskInstance[]>`；底层 `generateInstancesForTask()` 会在假期模式生效时过滤掉落在假期区间内的周期任务与持续进度任务实例
  - `countTodayMissed()` — 统计已错过实例（**排除进度任务**，避免天天泛滥），用于主区域底部的红色提醒条
  - `findCompletionForSkipDay()` — 跳过日撤销时定位对应的完成记录

- **`use-app-state.ts`** — React 钩子，唯一的状态写入口：
  - 初始化时同步从 `localStorage` 加载；**没有任何预加载示例任务**（空状态起步）
  - 每次状态变化自动整体持久化回 `localStorage`
  - 回收站：`deleteTask` 不直接删除，移入 `trash`（`expiresAt` = 删除次日 24 点，即"隔天24点"）；加载时及每 2 分钟定时清理过期项；支持 `restoreTask` / `permanentlyDeleteTask` / `emptyTrash`
  - **分组级联**：任务带 `groupId` 时，删除会级联删除同组全部任务、恢复会级联恢复同组回收站任务（`addGroup`/`deleteGroup` 已在此实现，但当前 UI 没有创建分组的入口——分组是数据层就绪、UI 未接线的能力；`TaskInstance.groupName` 同样未被组件使用）
  - 学习主题：`createTheme` / `deleteTheme`（删除主题时清除相关任务的 `themeId`）
  - `completeInstance` / `uncompleteInstance`：进度任务累加/递减 `dailyCompletions[date]`；计数模式任务累加/递减 `completions[date]`（次数）；其余任务写入/删除完成时间戳
  - `createId()` 生成短 ID（`Math.random` + `Date.now` 混合）

- **`status-visuals.ts`** — 无状态辅助函数：`dotColor()`（实例状态 → 圆点颜色，完成=绿/错过=红/假期=灰/跳过=黄/其余=类型色）、`typeColor()`、`isFaded()`（未来/假期淡化）、`STATUS_LABEL`（中文状态标签）、`statusTextClass()`。

- **`utils.ts`** — `cn()` 工具函数，整合 `clsx` 和 `tailwind-merge`。

### UI 层 (`components/calendar/`)

- **`calendar-app.tsx`** — 根客户端组件。管理视图状态（`anchor`、`selected`、`view`、`focusedTaskId`），通过 `buildInstanceMap` 计算 `instanceMap`（useMemo 缓存），渲染布局：头部 + 视图面板 + 右侧边栏 + 各对话框 + 底部错过提醒条。
- **`calendar-header.tsx`** — 视图切换器（月/周/日）、导航箭头、"今天"按钮、日期跳转、假期对话框按钮、回收站按钮（含数量角标）、新建任务按钮。
- 视图面板（按条件渲染）：
  - `month-view.tsx` — 7 列网格，每格用 `dots-row.tsx` 的 `DotsRow` 显示任务状态圆点
  - `week-view.tsx` — 7 列布局，每天显示任务名称标签
  - `day-view.tsx` — 全天任务列表，使用 `instance-item.tsx` 的 `InstanceItem` 卡片
- **`day-sidebar.tsx`** — 右侧边栏，显示选中日期的任务（月/周视图下显示）。
- **`instance-item.tsx`** — 任务实例卡片：完成/撤销按钮（计数模式显示次数）、跳过日撤销、"在日历上查看"聚焦按钮、暂停切换。
- **`task-form.tsx`** — 模态对话框（约 800 行）：创建/编辑四种任务类型，含类型专属字段（执行日期、重复频率、复习间隔序列 + **间隔预览表**、持续进度**步骤列表**每步独立推进天数、结束条件、计数模式开关、学习主题选择/创建）。持续进度任务的步骤编辑由 `ProgressStepEditor` 处理：有完成记录后，步骤结构（增删步骤、起始步骤、模式切换）被锁定，但步骤名称、推进天数与起始日期仍可修改；推进天数与起始日期的修改会基于当前 `steps.interval` 与 `startDate` 实时重算进度条覆盖范围。任务名称必填，未填时弹出自动消失的提示（toast）。
- **`progress-step-editor.tsx`** — `TaskForm` 的进度任务步骤编辑器子组件，负责简洁/详细模式切换、步骤增删、名称与推进天数编辑，以及有完成记录时的结构锁定与影响提示。
- **`holiday-dialog.tsx`** — 管理假期日期区间 + 假期模式启用开关。
- **`trash-dialog.tsx`** — 回收站：查看、恢复、彻底删除、清空。
- **`legend.tsx`** — 图例组件，**当前未被任何文件引用**（留存代码，改动布局时注意它不在渲染树中）。

### UI 组件库 (`components/ui/`)

预构建的 shadcn/ui 组件（Button、Dialog、Input、Select、Switch、Tabs、Badge、Label、Textarea、RadioGroup、ScrollArea）。通用非应用特定组件——除非添加新的 shadcn 组件，否则避免修改。

### 关键数据流

1. `useAppState()` 初始化时从 `localStorage` 加载全部数据（首次使用为空状态）
2. `calendar-app.tsx` 调用 `buildInstanceMap(state.tasks, activeHolidays, rangeStart, rangeEnd, today)`，范围由视图决定，useMemo 缓存
3. 实例映射传递给视图组件渲染；选中日实例单独按单日范围计算（`selectedInstances`），保证三视图一致
4. 用户交互（完成/撤销、创建/编辑/删除、暂停切换）经回调到 `useAppState`
5. `useAppState` 更新 React 状态，状态变化后自动持久化到 `localStorage`
6. 页面刷新时重新从 `localStorage` 加载

### 假期模式

当 `holidayModeEnabled` 为 true 时，`activeHolidays` 非空，落在假期区间内的周期任务与持续进度任务实例在生成层被过滤（`generateInstancesForTask`），所有视图（月/周/日/侧边栏）不显示，周期任务假期内也不计 missed；日常任务与复习任务不受影响。隐藏仅为显示层行为，不改动任何任务数据与调度，假期结束后自动恢复显示。

### 任务视图（Focused View）

点击任务卡片上的"在日历上查看"按钮后聚焦单个任务：

- 激活后自动切换到月视图；月/周视图中仅高亮该任务的日期（非进度任务）或整个进度条范围（进度任务），其他内容半透明隐藏
- 通过头部"退出任务视图"按钮或再次点击同一任务按钮退出；删除被聚焦任务（或其同组任务）时自动退出
- 逻辑位于 `month-view.tsx` / `week-view.tsx` 中 `focusedTaskId` / `focusedInstanceMap` / `focusedProgress` 相关条件渲染

**进度任务聚焦染色规则**（由 `calendar-app.tsx` 的 `focusedProgress` 计算）：

- `startDate` 到 `barEnd`（`computeProgressBarEnd()` 结果）→ 绿色进度条覆盖
- `barEnd` 之后（不含）到今天（含）→ 红色（尚未覆盖的逾期区域）
- 今天之后 → 无特殊染色
- `paused` 任务进度条截至今天，不展示未来覆盖区域

## 测试数据

**应用启动时没有任何预加载示例任务。** 所有任务数据通过以下两种方式之一创建：

### 方式 A：浏览器控制台脚本（推荐）

在对话中生成脚本 → 粘贴到浏览器 F12 控制台执行 → 数据写入 localStorage → 页面自动刷新显示。

清空数据：

```js
localStorage.removeItem('calendar-app-state');
location.reload();
```

### 方式 B：临时硬编码注入（当用户无法/不便操作控制台时）

1. 在 `use-app-state.ts` 的 `loadState()` 之后写入一条 `localStorage.setItem(...)` 硬编码数据
2. `pnpm build` → 杀掉旧服务器 → `pnpm dev`
3. 用户告知"已刷新"后，**立即回退硬编码代码** → 再次 `pnpm build` → 重启服务器
4. 用户再次刷新，代码恢复空白，但数据已留在 localStorage 中

## 约定

- 所有日期使用 `DateKey` 字符串（`YYYY-MM-DD`），状态中绝不使用 `Date` 对象
- CSS 使用 Tailwind v4 的 `@theme inline` 标记和 CSS 自定义属性（`--status-single`、`--status-recurring`、`--status-ebbinghaus`、`--status-progress`、`--status-completed`、`--status-missed`、`--status-skipped` 等）表示状态颜色
- 导入使用 `@/` 路径别名
- 任务类型判别使用 `===` 比较（如 `task.type === 'recurring'`）
- 前端组件（`components/`、`lib/use-app-state.ts`）使用 `'use client'`；`lib/task-engine.ts`、`lib/date-utils.ts` 等保持无 React 依赖的纯函数
- 代码注释与 UI 文案使用中文
- 改动涉及状态结构（`AppState`）时，注意 `loadState()` 需要对旧版本地数据做兼容兜底（参考现有的 `groups`/`themes`/`trash` 数组校验写法）

## 安全注意事项

- 应用无后端、无网络请求、无密钥凭证；唯一持久化介质是浏览器 `localStorage`，不要在代码中引入任何敏感信息
- `scripts/serve.mjs` 会执行 `lsof | xargs kill -9` 释放被占端口，仅限本地开发使用
- 依赖安装使用 pnpm；新增依赖前先确认项目是否已有同类库（参见 `package.json`）

## 迁移到 Tauri 的路线图

> 如果想保留现有 UI 和功能，仅将底层换成 Tauri（独立桌面应用）：

### 需要重写的文件

| 文件 | 替换方案 |
|------|---------|
| `lib/use-app-state.ts` 中的 `localStorage` 调用 | 改为 `invoke()` 调用 Rust 命令，或 Rust 侧用 `tauri-plugin-store` 持久化 |
| `scripts/serve.mjs` + `next.config.mjs`（output: export） | Tauri 自带 WebView，删除 `scripts/`，可移除 `output: 'export'` |

### 需要新增的文件

`src-tauri/` 目录（`pnpm add -D @tauri-apps/cli` → `pnpm tauri init`），含 `Cargo.toml`（`serde`、`serde_json`，需要 SQLite 则加 `rusqlite`）、`src/main.rs`、`src/commands.rs`、图标与 `tauri.conf.json`。

### 完全不变的文件

`lib/types.ts`、`lib/task-engine.ts`、`lib/date-utils.ts`、`lib/status-visuals.ts`、`components/calendar/*`、`components/ui/*`、`app/globals.css` 均为纯前端代码，可原封不动复用。

### 存储位置变化

| 当前 | Tauri 后 |
|------|---------|
| 浏览器 `localStorage` | `~/Library/Application Support/<app-id>/` 下的 SQLite 或 `tauri-plugin-store` JSON |
