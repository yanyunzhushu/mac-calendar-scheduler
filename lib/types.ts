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
}

export interface SingleTask extends BaseTask {
  type: 'single'
  /** 普通任务的执行日期 */
  date: DateKey
}

export interface RecurringTask extends BaseTask {
  type: 'recurring'
  startDate: DateKey
  freq: RecurrenceFreq
  interval: number // customDays 时表示每 N 天
  end: EndCondition
}

export interface EbbinghausTask extends BaseTask {
  type: 'ebbinghaus'
  startDate: DateKey // 第 0 天学习日
  intervals: number[] // 从 0 开始的间隔天数序列
  end: EndCondition // count 表示复习轮数
}

export interface ProgressTask extends BaseTask {
  type: 'progress'
  startDate: DateKey
  interval: number // 推进间隔 N 天
}

export type Task = RecurringTask | EbbinghausTask | ProgressTask

export interface Holiday {
  id: string
  start: DateKey
  end: DateKey
}

export interface AppState {
  tasks: Task[]
  holidays: Holiday[]
  holidayModeEnabled: boolean
}

/** 单个日期格上某任务实例的展示状态 */
export type InstanceStatus =
  | 'pending' // 待完成（今天或更早未完成 且非未来）
  | 'completed' // 已按时完成
  | 'missed' // 已错过
  | 'future' // 未来待完成
  | 'holiday' // 处于假期暂停

export interface TaskInstance {
  taskId: string
  taskName: string
  taskType: TaskType
  date: DateKey
  status: InstanceStatus
  /** 该实例是否可标记完成（仅 pending/missed/today 可操作） */
  actionable: boolean
  /** 用于排序/展示的额外信息，如复习第几轮 */
  meta?: string
}

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  recurring: '周期任务',
  ebbinghaus: '艾宾浩斯复习',
  progress: '持续进度',
}

/** 各任务类型的基础（待完成）颜色 */
export const TASK_TYPE_COLOR: Record<TaskType, string> = {
  recurring: '#3b82f6', // 蓝
  ebbinghaus: '#a855f7', // 紫
  progress: '#f59e0b', // 橙
}
