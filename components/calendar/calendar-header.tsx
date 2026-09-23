'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, DatabaseBackup, ListTodo, Palmtree, PanelRightClose, PanelRightOpen, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fromKey, type DateKey } from '@/lib/date-utils'
import { parseDateInput } from '@/lib/date-validation'

const MONTHS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

function formatDate(key: DateKey): string {
  const d = fromKey(key)
  return `${d.getFullYear()} 年 ${MONTHS[d.getMonth()]} 月 ${d.getDate()} 日`
}

export type ViewMode = 'month' | 'week' | 'day'

function formatInputHint(key: DateKey): string {
  // 显示当月，用户可覆盖输入具体日期
  return key.substring(0, 7)
}

interface CalendarHeaderProps {
  view: ViewMode
  anchor: DateKey
  selected: DateKey
  holidayEnabled: boolean
  trashCount: number
  onViewChange: (v: ViewMode) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onJump: (key: DateKey) => void
  onOpenHoliday: () => void
  onOpenTrash: () => void
  onOpenTasks: () => void
  onOpenBackup: () => void
  sidebarVisible: boolean
  onToggleSidebar: () => void
  showFutureRecurring: boolean
  onToggleFutureRecurring: () => void
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
  selected,
  holidayEnabled,
  trashCount,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  onJump,
  onOpenHoliday,
  onOpenTrash,
  onOpenTasks,
  onOpenBackup,
  sidebarVisible,
  onToggleSidebar,
  showFutureRecurring,
  onToggleFutureRecurring,
  onCreate,
}: CalendarHeaderProps) {
  const [inputValue, setInputValue] = useState(() => formatInputHint(anchor))
  const [jumpError, setJumpError] = useState<string | null>(null)
  const inputDirty = useRef(false)
  const invalidDateMessage = '请输入 2000—2100 年内的有效日期（YYYY-MM 或 YYYY-MM-DD）'

  // 外部导航时同步输入；未改动输入框的失焦不触发跳转。
  useEffect(() => {
    setInputValue(formatInputHint(anchor))
    setJumpError(null)
    inputDirty.current = false
  }, [anchor])

  function handleJump() {
    const key = parseDateInput(inputValue)
    if (!key) {
      setJumpError(invalidDateMessage)
      return
    }
    inputDirty.current = false
    setJumpError(null)
    setInputValue(formatInputHint(key))
    onJump(key)
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/60 px-5 py-3 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight tabular-nums">
          {formatDate(selected)}
        </h1>
        <div className="flex flex-col gap-1">
          <input
            type="text"
            value={inputValue}
            aria-label="跳转日期"
            aria-invalid={!!jumpError}
            aria-describedby={jumpError ? 'date-jump-error' : undefined}
            placeholder="YYYY-MM 或 YYYYMMDD"
            onChange={(e) => {
              setInputValue(e.target.value)
              inputDirty.current = true
              if (jumpError) setJumpError(parseDateInput(e.target.value) ? null : invalidDateMessage)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleJump()
              }
            }}
            onBlur={() => {
              if (inputDirty.current) handleJump()
            }}
            className="h-8 w-36 rounded-md border border-border bg-background px-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring aria-invalid:border-red-500"
          />
          {jumpError && (
            <p id="date-jump-error" role="alert" className="max-w-56 text-xs text-red-500">{jumpError}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrev}>
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">上一页</span>
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={onToday}>
            回到今天
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNext}>
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">下一页</span>
          </Button>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="flex shrink-0 items-center rounded-lg border border-border bg-muted/50 p-0.5">
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
        {view !== 'day' && (
          <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={onToggleSidebar} aria-expanded={sidebarVisible} aria-controls="calendar-day-sidebar">
            {sidebarVisible ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            {sidebarVisible ? '收起侧栏' : '展开侧栏'}
          </Button>
        )}
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onOpenTasks}>
          <ListTodo className="h-4 w-4" />
          全部任务
        </Button>
        <Button variant={showFutureRecurring ? 'default' : 'outline'} size="sm" className="h-8" aria-pressed={showFutureRecurring} onClick={onToggleFutureRecurring} title="显示周期任务的未来计划，仅供预览">
          显示未来计划
        </Button>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground" onClick={onOpenBackup}>
          <DatabaseBackup className="h-4 w-4" />
          备份
        </Button>
        <Button
          variant={holidayEnabled ? 'default' : 'outline'}
          size="sm"
          className="h-8 gap-1.5"
          onClick={onOpenHoliday}
        >
          <Palmtree className="h-4 w-4" />
          假期
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-muted-foreground"
          onClick={onOpenTrash}
        >
          <Trash2 className="h-4 w-4" />
          回收站
          {trashCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
              {trashCount}
            </span>
          )}
        </Button>
        <Button size="sm" className="h-8 gap-1.5" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          新建任务
        </Button>
      </div>
    </header>
  )
}
