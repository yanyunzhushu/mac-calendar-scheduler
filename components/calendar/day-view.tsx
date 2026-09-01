'use client'

import { formatLong, type DateKey } from '@/lib/date-utils'
import type { Holiday, Task, TaskInstance } from '@/lib/types'
import { findHoliday } from '@/lib/task-engine'
import { InstanceItem } from './instance-item'

interface DayViewProps {
  selected: DateKey
  today: DateKey
  instances: TaskInstance[]
  tasks: Task[]
  holidays: Holiday[]
  onComplete: (taskId: string, date: DateKey) => void
  onUncomplete: (taskId: string, date: DateKey) => void
  onOpenTask: (taskId: string) => void
  onFocusTask?: (taskId: string) => void
  onTogglePause?: (taskId: string) => void
  focusedTaskId?: string | null
}

export function DayView({
  selected,
  today,
  instances,
  tasks,
  holidays,
  onComplete,
  onUncomplete,
  onOpenTask,
  onFocusTask,
  onTogglePause,
  focusedTaskId,
}: DayViewProps) {
  const holiday = findHoliday(selected, holidays)
  return (
    <div className="macos-scroll mx-auto flex h-full w-full max-w-2xl flex-col gap-3 overflow-y-auto p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{formatLong(selected)}</h2>
        {selected === today && (
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
            今天
          </span>
        )}
      </div>
      {holiday && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          假期期间，周期任务与持续进度任务不显示
        </div>
      )}
      {instances.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">这一天没有安排任务</p>
      ) : (
        instances.map((inst, i) => (
          <InstanceItem
            key={`${inst.taskId}-${i}`}
            inst={inst}
            task={tasks.find((t) => t.id === inst.taskId)}
            onComplete={() => onComplete(inst.taskId, inst.date)}
            onUncomplete={() => onUncomplete(inst.taskId, inst.date)}
            onOpenTask={() => onOpenTask(inst.taskId)}
            onFocusTask={onFocusTask}
            onTogglePause={onTogglePause}
            isFocused={focusedTaskId === inst.taskId}
            focusedTaskId={focusedTaskId}
          />
        ))
      )}
    </div>
  )
}
