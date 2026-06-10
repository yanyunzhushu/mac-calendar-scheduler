'use client'

import { formatLong, type DateKey } from '@/lib/date-utils'
import type { Holiday, TaskInstance } from '@/lib/types'
import { findHoliday } from '@/lib/task-engine'
import { InstanceItem } from './instance-item'

interface DayViewProps {
  selected: DateKey
  today: DateKey
  instances: TaskInstance[]
  holidays: Holiday[]
  onComplete: (taskId: string, date: DateKey) => void
  onUncomplete: (taskId: string, date: DateKey) => void
  onOpenTask: (taskId: string) => void
}

export function DayView({
  selected,
  today,
  instances,
  holidays,
  onComplete,
  onUncomplete,
  onOpenTask,
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
          假期期间，持续进度任务暂停推进
        </div>
      )}
      {instances.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">这一天没有安排任务</p>
      ) : (
        instances.map((inst, i) => (
          <InstanceItem
            key={`${inst.taskId}-${i}`}
            inst={inst}
            onComplete={() => onComplete(inst.taskId, inst.date)}
            onUncomplete={() => onUncomplete(inst.taskId, inst.date)}
            onOpenTask={() => onOpenTask(inst.taskId)}
          />
        ))
      )}
    </div>
  )
}
