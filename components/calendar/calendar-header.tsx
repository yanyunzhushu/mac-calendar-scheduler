'use client'

import { ChevronLeft, ChevronRight, Palmtree, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatMonthTitle, type DateKey } from '@/lib/date-utils'

export type ViewMode = 'month' | 'week' | 'day'

interface CalendarHeaderProps {
  view: ViewMode
  anchor: DateKey
  holidayEnabled: boolean
  onViewChange: (v: ViewMode) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onOpenHoliday: () => void
  onCreate: () => void
}

const VIEW_LABEL: Record<ViewMode, string> = {
  month: '月',
  week: '周',
  day: '日',
}

export function CalendarHeader({
  view,
  anchor,
  holidayEnabled,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  onOpenHoliday,
  onCreate,
}: CalendarHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/60 px-5 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <h1 className="min-w-44 text-xl font-semibold tracking-tight tabular-nums">
          {formatMonthTitle(anchor)}
        </h1>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrev}>
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">上一页</span>
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={onToday}>
            今天
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNext}>
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">下一页</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
          {(['month', 'week', 'day'] as ViewMode[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onViewChange(v)}
              className={cn(
                'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                view === v
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
        <Button
          variant={holidayEnabled ? 'default' : 'outline'}
          size="sm"
          className="h-8 gap-1.5"
          onClick={onOpenHoliday}
        >
          <Palmtree className="h-4 w-4" />
          假期
        </Button>
        <Button size="sm" className="h-8 gap-1.5" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          新建任务
        </Button>
      </div>
    </header>
  )
}
