'use client'

import { cn } from '@/lib/utils'
import { fromKey, getWeekDays, weekdayLabel, type DateKey } from '@/lib/date-utils'
import type { Holiday, TaskInstance } from '@/lib/types'
import { findHoliday } from '@/lib/task-engine'
import { dotColor, isFaded, STATUS_LABEL } from '@/lib/status-visuals'

interface WeekViewProps {
  anchor: DateKey
  today: DateKey
  selected: DateKey
  instanceMap: Record<DateKey, TaskInstance[]>
  holidays: Holiday[]
  onSelect: (key: DateKey) => void
}

export function WeekView({
  anchor,
  today,
  selected,
  instanceMap,
  holidays,
  onSelect,
}: WeekViewProps) {
  const days = getWeekDays(anchor)

  return (
    <div className="grid h-full grid-cols-7">
      {days.map((key) => {
        const d = fromKey(key)
        const isToday = key === today
        const isSelected = key === selected
        const instances = instanceMap[key] ?? []
        const holiday = findHoliday(key, holidays)
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={cn(
              'flex flex-col gap-2 border-r border-border p-3 text-left transition-colors',
              'hover:bg-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              isSelected && 'bg-accent',
            )}
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-muted-foreground">{weekdayLabel(key)}</span>
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm tabular-nums',
                  isToday && 'bg-primary font-semibold text-primary-foreground',
                )}
              >
                {d.getDate()}
              </span>
              {holiday && (
                <span className="rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-700">
                  假期
                </span>
              )}
            </div>
            <div className="macos-scroll flex flex-1 flex-col gap-1 overflow-y-auto">
              {instances.map((inst, i) => (
                <div
                  key={`${inst.taskId}-${i}`}
                  className="flex items-center gap-1.5 rounded-md bg-muted/50 px-1.5 py-1"
                  style={{ opacity: isFaded(inst.status) ? 0.55 : 1 }}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: dotColor(inst) }}
                  />
                  <span className="truncate text-[11px] leading-tight">{inst.taskName}</span>
                </div>
              ))}
            </div>
          </button>
        )
      })}
    </div>
  )
}
