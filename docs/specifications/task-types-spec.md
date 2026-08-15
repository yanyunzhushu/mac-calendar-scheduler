# 任务类型规格

本文档详细描述四种任务类型的数据结构和实例生成逻辑。

## 类型层次

```
Task (联合类型)
├── SingleTask    — 日常任务
├── RecurringTask — 周期任务
├── EbbinghausTask— 复习任务
└── ProgressTask  — 持续进度任务
```

## 共有字段 (BaseTask)

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 唯一标识（短 ID） |
| `type` | `TaskType` | 任务类型 |
| `name` | `string` | 任务名称（必填） |
| `description` | `string?` | 备注 |
| `createdAt` | `number` | 创建时间戳 |
| `completions` | `Record<DateKey, number>` | 完成记录（日期 → 时间戳） |
| `paused` | `boolean?` | 是否暂停 |
| `groupId` | `string?` | 所属分组 ID |
| `themeId` | `string?` | 学习主题 ID（仅复习任务使用） |

---

## 日常任务 (SingleTask)

**适用场景**: 一次性待办事项

### 独有字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `date` | `DateKey` | 唯一执行日期 |
| `countingMode` | `boolean?` | 计数模式：同日可多次完成 |

### 实例生成

- 仅在 `date` 当天生成实例
- 计数模式：`actionable` 在到期后持续为 true，`count` 展示完成次数

---

## 周期任务 (RecurringTask)

**适用场景**: 每日/每周/每月重复的任务

### 独有字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `startDate` | `DateKey` | 首次出现日期 |
| `freq` | `RecurrenceFreq` | 频率：daily / weekly / monthly / customDays |
| `interval` | `number` | customDays 时表示每 N 天 |
| `end` | `EndCondition` | 结束条件 |
| `countingMode` | `boolean?` | 每个发生日可多次完成 |

### 结束条件

| type | 说明 |
|------|------|
| `never` | 永不结束 |
| `count` | 完成 N 次后停止 |
| `date` | 指定截止日期后停止 |

### 实例生成

- 从 `startDate` 按频率遍历日历
- 遵守结束条件，超出则停止
- 不生成今天之后的实例；若 `startDate` 在未来，则仅在该日期落在视图范围内时显示一个灰色的 `future` 标记
- `paused` 的任务同样遵守上述未来隐藏规则
- 假期模式下被假期区间覆盖的实例不生成

---

## 复习任务 (EbbinghausTask)

**适用场景**: 基于艾宾浩斯遗忘曲线的间隔复习

### 独有字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `startDate` | `DateKey` | 第 0 天（首次学习日） |
| `intervals` | `number[]` | 间隔序列，默认 `[0,1,2,4,7,15,30,60]` |
| `end` | `EndCondition` | 结束条件（count 表示复习轮数） |

### 实例生成

1. 从 `startDate` 开始
2. 第 0 天（位置 0）：生成第 0 天的实例（`meta`: "首次学习"）
3. 第 N 个间隔后：`startDate + intervals[N]` 生成实例（`meta`: "第 N 次复习"）
4. 超出间隔序列后以最后一个间隔循环
5. 遵守结束条件
6. 不受假期模式影响

---

## 持续进度任务 (ProgressTask)

**适用场景**: 有累积进度的长期任务，如阅读计划、课程推进

### 独有字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `startDate` | `DateKey` | 进度起点 |
| `steps` | `ProgressStep[]` | 步骤列表，每步有独立推进天数 |
| `defaultInterval` | `number?` | 无步骤时每完成一次推进的天数 |
| `dailyCompletions` | `Record<DateKey, number>` | 每日完成步骤数（支持链式完成） |
| `startStepIndex` | `number?` | 起始步骤索引（0-based），创建后不可修改 |

### ProgressStep

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 步骤名 |
| `interval` | `number` | 完成此步骤后进度条推进的天数 |

### 进度条模型

- `computeProgressBarEnd()` = `startDate + 已完成步骤累计 interval` 的总天数 - 1
- 步骤按顺序循环：步骤 A → 步骤 B → 步骤 C → 回到步骤 A
- 每日多次完成：当天每完成一次推进当前步骤的 interval 天
- 步骤名在实例中展示：待完成日 → `"任务名 (步骤名)"`

### 实例生成

- 仅生成 `startDate` 到今天为止的实例（未来日不生成）
- 当天有完成记录 → 合并为一个已完成实例（count + meta 步骤链）
- 当天无完成 → 按进度条位置判定：已覆盖 → skipped / 未覆盖 + 过去日 → missed / 今天 → pending
- **今天始终为 pending 且可操作**，与进度条覆盖状态无关
- 假期模式下被假期区间覆盖的实例为 `holiday` 状态
- paused 任务的今天实例为 `holiday` 状态

---

## 任务实例 (TaskInstance)

生成的只读实例对象，由 `buildInstanceMap()` 按日期聚合输出。

| 字段 | 类型 | 说明 |
|------|------|------|
| `taskId` | `string` | 来源任务 ID |
| `taskName` | `string` | 显示名（进度任务含步骤名） |
| `taskType` | `TaskType` | 任务类型 |
| `date` | `DateKey` | 实例日期 |
| `status` | `InstanceStatus` | 状态 |
| `actionable` | `boolean` | 是否可操作 |
| `count` | `number?` | 完成次数 |
| `meta` | `string?` | 附加信息 |

### InstanceStatus

| 状态 | 说明 |
|------|------|
| `pending` | 待完成（今天或更早未完成） |
| `completed` | 已完成 |
| `missed` | 已错过 |
| `future` | 未来日，尚无实例 |
| `holiday` | 假期暂停 |
| `skipped` | 持续进度：未做或已覆盖 |
