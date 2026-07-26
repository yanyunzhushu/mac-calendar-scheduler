# 数据持久化规格

## 存储方案

- **介质**: 浏览器 `localStorage`
- **键名**: `calendar-app-state`
- **格式**: JSON 字符串（`AppState` 类型）
- **时机**: 每次状态变化时自动整体序列化写入

---

## AppState 完整结构

```ts
interface AppState {
  tasks: Task[]            // 所有任务（四种类型混合存储）
  holidays: Holiday[]      // 假期区间列表
  holidayModeEnabled: boolean  // 假期模式开关
  groups: TaskGroup[]      // 任务分组
  themes: Theme[]          // 学习主题
  trash: TrashItem[]       // 回收站
}
```

## Task

联合类型，按 `type` 字段区分：

- `type === 'single'` → `SingleTask`
- `type === 'recurring'` → `RecurringTask`
- `type === 'ebbinghaus'` → `EbbinghausTask`
- `type === 'progress'` → `ProgressTask`

## 持久化流程

### 加载 (loadState)

```ts
function loadState(): AppState {
  const raw = localStorage.getItem('calendar-app-state')
  if (!raw) return getDefaultState()  // 首次使用 → 空状态
  const parsed = JSON.parse(raw)
  return migrateState(parsed)          // 兼容旧版本数据
}
```

- 首次使用 → 空状态（无预加载示例任务）
- 已有数据 → 解析 JSON → 版本迁移 → 返回

### 保存 (persist)

```ts
useEffect(() => {
  localStorage.setItem('calendar-app-state', JSON.stringify(state))
}, [state])
```

- 每次 `state` 变化自动触发
- 整体序列化，非增量更新

### 版本兼容

`loadState()` 中的 `migrateState()` 负责：
- 旧版本缺少 `groups` → 补充 `[]`
- 旧版本缺少 `themes` → 补充 `[]`
- 旧版本缺少 `trash` → 补充 `[]`
- 其他字段变更时添加兼容兜底

---

## 回收站机制

### TrashItem

| 字段 | 类型 | 说明 |
|------|------|------|
| `task` | `Task` | 被删除的任务完整数据 |
| `deletedAt` | `number` | 删除时间戳 |
| `expiresAt` | `number` | 到期时间戳（删除次日 24:00） |

### 清理策略

- 加载时清理过期项
- 每 2 分钟定时清理过期项
- 过期时间 = 删除日次日 24:00（约 1 天反悔窗口）

### 操作

- `deleteTask` → 移入回收站（非直接删除）
- `restoreTask` → 从回收站恢复（分组任务级联恢复）
- `permanentlyDeleteTask` → 彻底删除
- `emptyTrash` → 清空回收站

---

## 数据导出/导入

### 导出

```js
// 在浏览器控制台执行
copy(localStorage.getItem('calendar-app-state'))
// 剪贴板中即为完整 JSON 数据
```

### 导入

```js
localStorage.setItem('calendar-app-state', '<JSON字符串>')
location.reload()
```

### 清空

```js
localStorage.removeItem('calendar-app-state')
location.reload()
```

---

## 安全考虑

- 数据仅存于本地浏览器，不发送到任何服务器
- 无网络请求，无第三方数据共享
- 清除浏览器数据 → 数据永久丢失
- 建议定期导出备份
