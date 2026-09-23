'use client'

import { cn } from '@/lib/utils'
import {
  WEEKDAY_HEADERS,
  compareKey,
  fromKey,
  getMonthGrid,
  type DateKey,
} from '@/lib/date-utils'
import type { Holiday, TaskInstance } from '@/lib/types'
import { findHoliday } from '@/lib/task-engine'

interface FocusedProgress {
  startDate: DateKey
  barEnd: DateKey
  paused?: boolean
}

interface MonthViewProps {
  anchor: DateKey
  today: DateKey
  selected: DateKey
  holidays: Holiday[]
  onSelect: (key: DateKey) => void
  focusedTaskId?: string | null
  focusedInstanceMap?: Record<DateKey, TaskInstance[]>
  focusedProgress?: FocusedProgress | null
}

export function MonthView({
  anchor,
  today,
  selected,
  holidays,
  onSelect,
  focusedTaskId,
  focusedInstanceMap,
  focusedProgress,
}: MonthViewProps) {
  const grid = getMonthGrid(anchor)
  const currentMonth = fromKey(anchor).getMonth()

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="grid shrink-0 grid-cols-7 border-b border-border">
        {WEEKDAY_HEADERS.map((w) => (
          <div
            key={w}
            className="py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-7 grid-rows-6">
        {grid.map((key) => {
          const d = fromKey(key)
          const inMonth = d.getMonth() === currentMonth
          const isToday = key === today
          const isSelected = key === selected
          const holiday = findHoliday(key, holidays)

          // 任务视图：判断该天是否有聚焦任务的实例
          const focusedInsts: TaskInstance[] | undefined =
            focusedTaskId && focusedInstanceMap ? focusedInstanceMap[key] : undefined
          const hasFocused = !!focusedInsts?.length
          const focusedAllCompleted = focusedInsts?.every((i) => i.status === 'completed') ?? false
          // 长期任务聚焦：没有完成/错过概念，使用粉色提醒染色
          const focusedIsReminder = focusedInsts?.every((i) => i.taskType === 'longterm') ?? false
          const focusedAllUncompleted = hasFocused && !focusedAllCompleted && !focusedIsReminder
          const isInactive = hasFocused && (compareKey(key, today) > 0 || focusedInsts?.every((i) => i.status === 'stopped'))

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
              aria-label={`选择 ${key}`}
              aria-pressed={isSelected}
              onClick={() => onSelect(key)}
              className={cn(
                'flex min-h-0 min-w-0 flex-col items-start overflow-hidden border-b border-r border-border text-left transition-colors',
                'gap-1 p-2',
                'hover:bg-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                !inMonth && 'bg-muted/60 text-muted-foreground/50',
                isSelected && 'bg-accent',
                // 非进度任务的原有聚焦染色（实例级）— 当月使用完整饱和度
                !focusedProgress && focusedTaskId && hasFocused && focusedAllCompleted && !isInactive && inMonth && 'bg-emerald-50',
                !focusedProgress && focusedTaskId && focusedAllUncompleted && !isInactive && inMonth && 'bg-red-50',
                !focusedProgress && focusedTaskId && focusedIsReminder && !isInactive && inMonth && 'bg-pink-50 ring-2 ring-inset ring-pink-400',
                !focusedProgress && focusedTaskId && focusedIsReminder && !isInactive && !inMonth && 'bg-pink-50/50 ring-2 ring-inset ring-pink-400/40',
                !focusedProgress && focusedTaskId && hasFocused && !isInactive && inMonth && 'ring-2 ring-inset',
                !focusedProgress && focusedTaskId && hasFocused && focusedAllCompleted && !isInactive && inMonth && 'ring-emerald-400',
                !focusedProgress && focusedTaskId && hasFocused && focusedAllUncompleted && !isInactive && inMonth && 'ring-red-400',
                !focusedProgress && focusedTaskId && hasFocused && isInactive && inMonth && 'bg-gray-50 ring-2 ring-inset ring-gray-300',
                // 非进度任务聚焦染色 — 相邻月份降低饱和度以便区分
                !focusedProgress && focusedTaskId && hasFocused && focusedAllCompleted && !isInactive && !inMonth && 'bg-emerald-50/50 ring-2 ring-inset ring-emerald-400/40',
                !focusedProgress && focusedTaskId && hasFocused && focusedAllUncompleted && !isInactive && !inMonth && 'bg-red-50/50 ring-2 ring-inset ring-red-400/40',
                !focusedProgress && focusedTaskId && hasFocused && isInactive && !inMonth && 'bg-gray-50/50 ring-2 ring-inset ring-gray-300/40',
                // 进度任务进度条染色 — 当月使用完整饱和度
                barColor === 'green' && inMonth && 'bg-emerald-50 ring-2 ring-inset ring-emerald-400',
                barColor === 'red' && inMonth && 'bg-red-50 ring-2 ring-inset ring-red-400',
                barColor === 'gray' && inMonth && 'bg-gray-50 ring-2 ring-inset ring-gray-300',
                // 进度任务进度条染色 — 相邻月份降低饱和度以便区分
                barColor === 'green' && !inMonth && 'bg-emerald-50/50 ring-2 ring-inset ring-emerald-400/40',
                barColor === 'red' && !inMonth && 'bg-red-50/50 ring-2 ring-inset ring-red-400/40',
                barColor === 'gray' && !inMonth && 'bg-gray-50/50 ring-2 ring-inset ring-gray-300/40',
              )}
            >
              <div className="flex w-full shrink-0 items-center justify-between">
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-sm tabular-nums',
                    isToday && 'bg-primary font-semibold text-primary-foreground',
                    !isToday && inMonth && 'font-medium',
                    // 非进度任务日期数字 — 当月
                    !focusedProgress && focusedTaskId && hasFocused && focusedAllCompleted && !isInactive && inMonth && 'bg-emerald-200 text-emerald-900',
                    !focusedProgress && focusedTaskId && focusedAllUncompleted && !isInactive && inMonth && 'bg-red-200 text-red-900',
                    !focusedProgress && focusedTaskId && focusedIsReminder && !isInactive && inMonth && 'bg-pink-200 text-pink-900',
                    !focusedProgress && focusedTaskId && focusedIsReminder && !isInactive && !inMonth && 'bg-pink-200/60 text-pink-900/70',
                    !focusedProgress && focusedTaskId && hasFocused && isInactive && inMonth && 'bg-gray-200 text-gray-500',
                    // 进度任务日期数字 — 当月
                    barColor === 'green' && inMonth && 'bg-emerald-200 text-emerald-900',
                    barColor === 'red' && inMonth && 'bg-red-200 text-red-900',
                    barColor === 'gray' && inMonth && 'bg-gray-200 text-gray-500',
                    // 非进度任务日期数字 — 相邻月份降低饱和度
                    !focusedProgress && focusedTaskId && hasFocused && focusedAllCompleted && !isInactive && !inMonth && 'bg-emerald-200/60 text-emerald-900/70',
                    !focusedProgress && focusedTaskId && hasFocused && focusedAllUncompleted && !isInactive && !inMonth && 'bg-red-200/60 text-red-900/70',
                    !focusedProgress && focusedTaskId && hasFocused && isInactive && !inMonth && 'bg-gray-200/60 text-gray-500/70',
                    // 进度任务日期数字 — 相邻月份降低饱和度
                    barColor === 'green' && !inMonth && 'bg-emerald-200/60 text-emerald-900/70',
                    barColor === 'red' && !inMonth && 'bg-red-200/60 text-red-900/70',
                    barColor === 'gray' && !inMonth && 'bg-gray-200/60 text-gray-500/70',
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
            </button>
          )
        })}
      </div>
    </div>
  )
}
