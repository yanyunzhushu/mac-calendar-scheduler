import type { InstanceStatus, TaskInstance, TaskType } from './types'

/** 圆点颜色：完成=绿，错过=红，假期=灰，未来=浅色任务类型色，待完成=任务类型色 */
export function dotColor(inst: TaskInstance): string {
  switch (inst.status) {
    case 'completed':
      return 'var(--status-completed)'
    case 'missed':
      return 'var(--status-missed)'
    case 'holiday':
      return '#9ca3af'
    case 'future':
    case 'pending':
    default:
      return typeColor(inst.taskType)
  }
}

export function typeColor(type: TaskType): string {
  if (type === 'recurring') return 'var(--status-recurring)'
  if (type === 'ebbinghaus') return 'var(--status-ebbinghaus)'
  return 'var(--status-progress)'
}

/** 未来实例使用浅色（降低透明度） */
export function isFaded(status: InstanceStatus): boolean {
  return status === 'future' || status === 'holiday'
}

export const STATUS_LABEL: Record<InstanceStatus, string> = {
  pending: '待完成',
  completed: '已完成',
  missed: '已错过',
  future: '未来',
  holiday: '假期暂停',
}

export function statusTextClass(status: InstanceStatus): string {
  switch (status) {
    case 'completed':
      return 'text-emerald-600'
    case 'missed':
      return 'text-red-500'
    case 'holiday':
      return 'text-muted-foreground'
    default:
      return 'text-foreground'
  }
}
