'use client'

import { cn } from '@/lib/utils'
import { compareKey, fromKey, getWeekDays, weekdayLabel, type DateKey } from '@/lib/date-utils'
import type { Holiday, TaskInstance } from '@/lib/types'
import { findHoliday } from '@/lib/task-engine'
import { dotColor, isFaded } from '@/lib/status-visuals'

interface FocusedProgress {
  startDate: DateKey
  barEnd: DateKey
  paused?: boolean
}

interface WeekViewProps {
  anchor: DateKey
  today: DateKey
  selected: DateKey
  instanceMap: Record<DateKey, TaskInstance[]>
  holidays: Holiday[]
  onSelect: (key: DateKey) => void
  focusedTaskId?: string | null
  focusedInstanceMap?: Record<DateKey, TaskInstance[]>
  focusedProgress?: FocusedProgress | null
}

export function WeekView({
  anchor,
  today,
  selected,
  instanceMap,
  holidays,
  onSelect,
  focusedTaskId,
  focusedInstanceMap,
  focusedProgress,
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

        // 任务视图：判断该天是否有聚焦任务的实例
        const focusedInsts: TaskInstance[] | undefined =
          focusedTaskId && focusedInstanceMap ? focusedInstanceMap[key] : undefined
        const hasFocused = !!focusedInsts?.length
        const focusedAllCompleted = focusedInsts?.every((i) => i.status === 'completed') ?? false
        const focusedAllUncompleted = hasFocused && !focusedAllCompleted
        const isFuture = hasFocused && compareKey(key, today) > 0

        // 持续推进任务进度条染色
        let barColor: 'green' | 'red' | 'gray' | null = null
        if (focusedProgress) {
          if (holiday) {
            barColor = 'gray'
          } else if (compareKey(key, focusedProgress.startDate) >= 0 && compareKey(key, focusedProgress.barEnd) <= 0) {
            // 绿色：从 startDate 到 barEnd（含两端）— 进度条已覆盖区域
            barColor = 'green'
          } else if (compareKey(key, focusedProgress.barEnd) > 0 && compareKey(key, today) <= 0 && !focusedProgress.paused) {
            // 红色：barEnd 之后（不含）到今天（含）— 尚未覆盖的逾期区域（暂停后不显示逾期）
            barColor = 'red'
          }
        }

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={cn(
              'flex flex-col gap-2 border-r border-border p-3 text-left transition-colors',
              'hover:bg-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              isSelected && 'bg-accent',
              !focusedProgress && focusedTaskId && hasFocused && focusedAllCompleted && !isFuture && 'bg-emerald-50',
              !focusedProgress && focusedTaskId && focusedAllUncompleted && !isFuture && 'bg-red-50',
              !focusedProgress && focusedTaskId && hasFocused && !isFuture && 'ring-2 ring-inset',
              !focusedProgress && focusedTaskId && hasFocused && focusedAllCompleted && !isFuture && 'ring-emerald-400',
              !focusedProgress && focusedTaskId && focusedAllUncompleted && !isFuture && 'ring-red-400',
              !focusedProgress && focusedTaskId && hasFocused && isFuture && 'bg-gray-50 ring-2 ring-inset ring-gray-300',
              barColor === 'green' && 'bg-emerald-50 ring-2 ring-inset ring-emerald-400',
              barColor === 'red' && 'bg-red-50 ring-2 ring-inset ring-red-400',
              barColor === 'gray' && 'bg-gray-50 ring-2 ring-inset ring-gray-300',
            )}
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-muted-foreground">
                {weekdayLabel(key)}
              </span>
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm tabular-nums',
                  isToday && 'bg-primary font-semibold text-primary-foreground',
                  !focusedProgress && focusedTaskId && hasFocused && focusedAllCompleted && !isFuture && 'bg-emerald-200 text-emerald-900',
                  !focusedProgress && focusedTaskId && focusedAllUncompleted && !isFuture && 'bg-red-200 text-red-900',
                  !focusedProgress && focusedTaskId && hasFocused && isFuture && 'bg-gray-200 text-gray-500',
                  barColor === 'green' && 'bg-emerald-200 text-emerald-900',
                  barColor === 'red' && 'bg-red-200 text-red-900',
                  barColor === 'gray' && 'bg-gray-200 text-gray-500',
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
            {!focusedTaskId && (
              <div className="macos-scroll flex flex-1 flex-col gap-1 overflow-y-auto">
                {instances.map((inst, i) => (
                  <div
                    key={`${inst.taskId}-${inst.date}-${inst.count ?? 0}-${i}`}
                    className="flex items-center gap-1.5 rounded-md bg-muted/50 px-1.5 py-1"
                    style={{ opacity: isFaded(inst.status) ? 0.55 : 1 }}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: dotColor(inst) }}
                    />
                    <span className="truncate text-[11px] leading-tight">{inst.taskName}</span>
                    {inst.status === 'completed' && inst.count != null && inst.count > 1 && (
                      <span className="shrink-0 text-[9px] font-semibold leading-none text-emerald-600 tabular-nums">
                        x{inst.count}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
