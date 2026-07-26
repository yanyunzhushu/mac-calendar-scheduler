# 系统架构概览

## 整体设计

「日程安排」是一个**纯客户端单页应用**，无后端服务、无数据库、无 API 层。

```
浏览器
├── React 应用 (Next.js Static Export)
│   ├── 状态层 (lib/)
│   │   ├── types.ts          — 类型定义
│   │   ├── date-utils.ts     — 日期工具函数
│   │   ├── task-engine.ts    — 任务实例生成引擎
│   │   ├── use-app-state.ts  — React 状态管理 + localStorage 持久化
│   │   ├── status-visuals.ts — 状态→颜色映射
│   │   └── utils.ts          — cn() 工具
│   └── UI 层 (components/)
│       ├── calendar/         — 业务组件（视图、表单、对话框）
│       └── ui/               — shadcn/ui 通用组件
└── localStorage (calendar-app-state)
```

## 核心数据流

```
localStorage
    ↓ loadState()
useAppState (React state)
    ↓ buildInstanceMap(tasks, holidays, range)
instanceMap: Record<DateKey, TaskInstance[]>
    ↓ props
视图组件 (MonthView / WeekView / DayView / DaySidebar)
    ↓ user interaction
回调函数 (completeInstance, createTask, deleteTask...)
    ↓ setState + persist
localStorage
```

## 文件组织

```
mac_calender/
├── app/
│   ├── globals.css          # 全局样式 + Tailwind v4 主题
│   ├── layout.tsx           # 根布局
│   └── page.tsx             # 入口页面（'use client'）
├── components/
│   ├── calendar/
│   │   ├── calendar-app.tsx # 根客户端组件
│   │   ├── calendar-header.tsx
│   │   ├── month-view.tsx   # 月视图 (7列网格)
│   │   ├── week-view.tsx    # 周视图 (7天横向)
│   │   ├── day-view.tsx     # 日视图 (任务列表)
│   │   ├── day-sidebar.tsx  # 右侧边栏
│   │   ├── dots-row.tsx     # 月视图圆点行
│   │   ├── instance-item.tsx# 任务实例卡片
│   │   ├── task-form.tsx    # 创建/编辑任务对话框
│   │   ├── holiday-dialog.tsx
│   │   ├── trash-dialog.tsx # 回收站对话框
│   │   └── legend.tsx       # 图例（当前未使用）
│   └── ui/                  # shadcn/ui 组件 (11个)
├── lib/
│   ├── types.ts             # 类型定义
│   ├── date-utils.ts        # 日期工具
│   ├── task-engine.ts       # 任务引擎
│   ├── use-app-state.ts     # 状态管理 + 持久化
│   ├── status-visuals.ts    # 状态可视化
│   └── utils.ts             # cn() 工具
├── scripts/
│   └── serve.mjs            # 开发静态服务器
├── public/
│   ├── manifest.json        # PWA 清单
│   └── sw.js                # Service Worker
├── next.config.mjs
├── tsconfig.json
├── postcss.config.mjs
└── package.json
```

## 关键设计原则

### 状态层与 UI 层分离

`lib/` 中的核心逻辑（`task-engine.ts`、`date-utils.ts`、`types.ts`）不含 React 依赖，为纯函数。这使得：

- 逻辑可以独立测试
- UI 框架可以替换
- Tauri 迁移时无需修改

### DateKey 字符串

所有日期使用 `YYYY-MM-DD` 格式字符串，绝不使用 `Date` 对象。原因：
- 无时区问题
- 可用作对象键
- 比较简洁（`'2026-07-25' > '2026-07-24'`）

### Static Export

Next.js 配置 `output: 'export'`，构建产物为纯 HTML/CSS/JS，无需 Node.js 服务器即可部署。`scripts/serve.mjs` 仅用于本地开发。

### localStorage 持久化

单一数据源：键名 `calendar-app-state`。状态变化时整体序列化写入（非增量更新），简化了加载和保存逻辑。

## 任务实例生成

`task-engine.ts` 的 `buildInstanceMap()` 是核心函数：

1. 接收所有任务 + 活跃假期 + 日期范围 + 今天
2. 对每个任务调用对应的生成函数
3. 假期模式下过滤假期区间内的周期/进度任务实例
4. 按日期聚合为 `Record<DateKey, TaskInstance[]>`
5. 视图组件从 instanceMap 取对应日期的实例渲染
