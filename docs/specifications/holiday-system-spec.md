# 假期系统规格

## 数据结构

### Holiday

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 唯一标识 |
| `start` | `DateKey` | 假期起始日 |
| `end` | `DateKey` | 假期结束日（含） |

### AppState 相关字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `holidays` | `Holiday[]` | 假期区间列表 |
| `holidayModeEnabled` | `boolean` | 假期模式全局开关 |

---

## 假期模式核心逻辑

### 生效条件

`holidayModeEnabled === true` AND `activeHolidays.length > 0`

### 影响范围

假期模式**仅对以下任务类型生效**：
- 周期任务 (RecurringTask)
- 持续进度任务 (ProgressTask)

**不受影响**的任务类型：
- 日常任务 (SingleTask)
- 复习任务 (EbbinghausTask)

### 过滤机制

在 `generateInstancesForTask()` 中：
- 判断实例日期是否落在任一 activeHoliday 区间内
- 落在区间内 → 实例状态为 `holiday`，不渲染
- 周期任务假期内不计 `missed`

### 行为特性

- 隐藏仅为显示层行为，**不改动任何任务数据与调度**
- 假期结束后自动恢复显示
- 假期内错过的周期任务不会标记为 missed

---

## 假期对话框 (HolidayDialog)

### 功能

1. **添加假期** — 选择起始和结束日期，添加到列表
2. **删除假期** — 从列表中移除假期区间
3. **假期模式开关** — 全局启用/禁用假期模式

### 交互

- 通过顶部日历图标按钮打开
- 假期模式开关独立于假期列表（可以有空列表 + 开关打开的情况）

---

## 进度任务的假期处理

- `findHoliday()` — 查找某日期是否落在假期区间内
- 假期区间内的进度任务实例在 `generateInstancesForTask()` 层被过滤，不渲染
- 今天处于假期时 → 进度任务实例为 `holiday` 状态，不可操作
- paused 任务的今天实例同样为 `holiday` 状态
