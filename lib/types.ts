import type { DateKey } from './date-utils'

export type TaskType = 'single' | 'recurring' | 'ebbinghaus' | 'progress'

/** 周期任务的重复频率 */
export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'customDays'

/** 结束条件类型 */
export type EndConditionType = 'never' | 'count' | 'date'

export interface EndCondition {
  type: EndConditionType
  count?: number // type === 'count'
  endDate?: DateKey // type === 'date'
}

export interface BaseTask {
  id: string
  type: TaskType
  name: string
  description?: string
  createdAt: number
  /** 实例完成记录：key 为日期键，value 为完成时间戳 */
  completions: Record<DateKey, number>
  paused?: boolean
  /** 所属任务组 ID */
  groupId?: string
  /** 学习主题 ID（仅用于复习任务分类） */
  themeId?: string
}

export interface SingleTask extends BaseTask {
  type: 'single'
  /** 计数模式：开启后可在同一天多次完成并记录次数 */
  countingMode?: boolean
  /** 普通任务的执行日期 */
  date: DateKey
}

export interface RecurringTask extends BaseTask {
  type: 'recurring'
  startDate: DateKey
  freq: RecurrenceFreq
  interval: number // customDays 时表示每 N 天
  end: EndCondition
  /** 计数模式：开启后每个发生日可多次完成并记录次数 */
  countingMode?: boolean
}

export interface EbbinghausTask extends BaseTask {
  type: 'ebbinghaus'
  startDate: DateKey // 第 0 天学习日
  intervals: number[] // 从 0 开始的间隔天数序列
  end: EndCondition // count 表示复习轮数
}

export interface ProgressStep {
  name: string
  interval: number  // 每次完成此步骤后推进的天数
}

export interface ProgressTask extends BaseTask {
  type: 'progress'
  startDate: DateKey
  steps: ProgressStep[] // 步骤列表，每个步骤有名称和独立推进天数
  /** 无详细步骤时每完成一次推进的天数 */
  defaultInterval?: number
  /** 每日完成步骤数：key=日期, value=该日完成的步骤次数（支持链式完成） */
  dailyCompletions?: Record<DateKey, number>
  /** 起始步骤索引（0-based），创建后不可修改 */
  startStepIndex?: number
}

export type Task = SingleTask | RecurringTask | EbbinghausTask | ProgressTask

export interface Holiday {
  id: string
  start: DateKey
  end: DateKey
}

export interface AppState {
  tasks: Task[]
  holidays: Holiday[]
  holidayModeEnabled: boolean
  groups: TaskGroup[]
  themes: Theme[]
  trash: TrashItem[]
}

/** 单个日期格上某任务实例的展示状态 */
export type InstanceStatus =
  | 'pending' // 待完成（今天或更早未完成 且非未来）
  | 'completed' // 已按时完成
  | 'missed' // 已错过
  | 'future' // 未来待完成
  | 'holiday' // 处于假期暂停
  | 'skipped' // 持续进度：未做（已跳过）

export interface TaskGroup {
  id: string
  name: string
  createdAt: number
}

export interface Theme {
  id: string
  name: string
  createdAt: number
}

export interface TrashItem {
  task: Task
  deletedAt: number
  expiresAt: number
}

export interface TaskInstance {
  /** 完成次数（计数模式或持续进度任务每日完成次数） */
  count?: number
  taskId: string
  taskName: string
  taskType: TaskType
  date: DateKey
  status: InstanceStatus
  /** 该实例是否可标记完成（仅 pending/missed/today 可操作） */
  actionable: boolean
  /** 用于排序/展示的额外信息，如复习第几轮 */
  meta?: string
  /** 所属分组名称 */
  groupName?: string
}

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  single: '日常任务',
  recurring: '周期任务',
  ebbinghaus: '复习任务',
  progress: '持续进度',
}

/** 各任务类型的基础（待完成）颜色 */
export const TASK_TYPE_COLOR: Record<TaskType, string> = {
  single: '#06b6d4', // 青色
  recurring: '#3b82f6', // 蓝
  ebbinghaus: '#a855f7', // 紫
  progress: '#f59e0b', // 橙
}
