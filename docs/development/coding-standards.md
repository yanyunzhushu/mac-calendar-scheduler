# 代码规范

## 命名约定

| 类别 | 规范 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `task-engine.ts`, `use-app-state.ts` |
| 组件名 | PascalCase | `CalendarApp`, `TaskForm` |
| 函数名 | camelCase | `buildInstanceMap`, `toKey` |
| 类型/接口 | PascalCase | `Task`, `TaskInstance`, `AppState` |
| 常量 | UPPER_SNAKE_CASE | `TASK_TYPE_LABEL`, `FREQ_LABELS` |
| CSS 变量 | kebab-case (前缀 `--status-`) | `--status-recurring`, `--status-completed` |

## 日期处理

- 所有日期使用 `DateKey` 类型（`YYYY-MM-DD` 字符串）
- 状态中**绝不**使用 JavaScript `Date` 对象
- 日期运算统一使用 `lib/date-utils.ts` 中的工具函数
- 日期的 `key` 命名使用 `toKey(date)` 而非手动拼接

## 导入路径

- 使用 `@/` 路径别名映射项目根目录
  ```ts
  import { toKey } from '@/lib/date-utils'
  import { cn } from '@/lib/utils'
  ```
- 相对路径仅用于同目录内引用

## TypeScript

- 任务类型判别使用 `===` 严格比较：
  ```ts
  if (task.type === 'recurring') { ... }
  ```
- 联合类型 `Task = SingleTask | RecurringTask | EbbinghausTask | ProgressTask`
- 新增任务字段时，需在 `loadState()` 中添加对旧版本数据的兼容兜底

## 组件

- 业务组件位于 `components/calendar/`
- 通用 UI 组件位于 `components/ui/`（shadcn/ui，避免修改）
- 需要浏览器 API 的组件标记 `'use client'`
- 纯逻辑模块（`lib/task-engine.ts`、`lib/date-utils.ts`）不添加 `'use client'`

## CSS / Tailwind

- 使用 Tailwind v4 的 `@theme inline` 定义自定义属性
- 状态颜色使用 CSS 变量：
  ```css
  --status-single: #06b6d4;
  --status-recurring: #3b82f6;
  --status-ebbinghaus: #a855f7;
  --status-progress: #f59e0b;
  ```
- 条件性类名拼接使用 `cn()` 函数（整合 `clsx` + `tailwind-merge`）

## 代码风格

- 代码注释使用中文
- UI 文案使用中文
- 技术术语保持英文原名（如 localStorage, React, TypeScript）
- 匹配已有代码风格，不混入不同的格式化偏好

## 状态管理

- `useAppState` 是唯一的状态写入口
- 所有数据变更经其回调函数（`createTask`、`completeInstance` 等）
- 状态变更后自动持久化到 localStorage
- 不要直接操作 `localStorage` 或绕过 `useAppState` 修改状态

## 安全

- 不要在代码中引入任何硬编码密钥、凭证或敏感信息
- 应用无后端、无网络请求，仅有的持久化介质是浏览器 localStorage
- `scripts/serve.mjs` 中的 `kill -9` 仅限本地开发使用
