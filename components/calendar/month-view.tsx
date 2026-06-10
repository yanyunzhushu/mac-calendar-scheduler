'use client'

import { cn } from '@/lib/utils'
import {
  WEEKDAY_HEADERS,
  fromKey,
  getMonthGrid,
  type DateKey,
} from '@/lib/date-utils'
import type { Holiday, TaskInstance } from '@/lib/types'
import { findHoliday } from '@/lib/task-engine'
import { DotsRow } from './dots-row'

interface MonthViewProps {
  anchor: DateKey
  today: DateKey
  selected: DateKey
  instanceMap: Record<DateKey, TaskInstance[]>
  holidays: Holiday[]
  onSelect: (key: DateKey) => void
}

export function MonthView({
  anchor,
  today,
  selected,
  instanceMap,
  holidays,
  onSelect,
}: MonthViewProps) {
  const grid = getMonthGrid(anchor)
  const currentMonth = fromKey(anchor).getMonth()

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAY_HEADERS.map((w) => (
          <div
            key={w}
            className="py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 grid-rows-6">
        {grid.map((key) => {
          const d = fromKey(key)
          const inMonth = d.getMonth() === currentMonth
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
                'flex flex-col items-start gap-1 border-b border-r border-border p-2 text-left transition-colors',
                'hover:bg-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                !inMonth && 'bg-muted/30 text-muted-foreground',
                isSelected && 'bg-accent ring-1 ring-inset ring-ring/40',
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-sm tabular-nums',
                    isToday && 'bg-primary font-semibold text-primary-foreground',
                    !isToday && inMonth && 'font-medium',
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
              <DotsRow instances={instances} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
