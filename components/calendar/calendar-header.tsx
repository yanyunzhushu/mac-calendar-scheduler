'use client'

import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Palmtree, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fromKey, type DateKey } from '@/lib/date-utils'

const MONTHS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

function formatDate(key: DateKey): string {
  const d = fromKey(key)
  return `${d.getFullYear()} 年 ${MONTHS[d.getMonth()]} 月 ${d.getDate()} 日`
}

export type ViewMode = 'month' | 'week' | 'day'

/** 解析用户输入的日期字符串，支持多种格式：
 *  YYYY.M / YYYY-MM / YYYYMM / YYYY.M.D / YYYY-MM-DD / YYYYMMDD 等 */
function parseDateInput(input: string): DateKey | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // 尝试按分隔符拆分：支持 . - /
  const parts = trimmed.split(/[.\-/]/).filter(Boolean)
  if (parts.length === 2 || parts.length === 3) {
    const y = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10)
    if (y < 2000 || y > 2100 || m < 1 || m > 12) return null
    const mm = String(m).padStart(2, '0')

    if (parts.length === 2) {
      return `${y}-${mm}-01`
    }
    const d = parseInt(parts[2], 10)
    if (d < 1 || d > 31) return null
    const dd = String(d).padStart(2, '0')
    return `${y}-${mm}-${dd}`
  }

  // 无分隔符：纯数字，按位数判断
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 6) {
    const y = parseInt(digits.substring(0, 4), 10)
    const m = parseInt(digits.substring(4, 6), 10)
    if (y < 2000 || y > 2100 || m < 1 || m > 12) return null
    return `${y}-${String(m).padStart(2, '0')}-01`
  }
  if (digits.length === 8) {
    const y = parseInt(digits.substring(0, 4), 10)
    const m = parseInt(digits.substring(4, 6), 10)
    const d = parseInt(digits.substring(6, 8), 10)
    if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  return null
}

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
  onCreate,
}: CalendarHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // 外部导航（箭头/回到今天）时同步 input 显示值
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = formatInputHint(anchor)
    }
  }, [anchor])

  function handleJumpAndKeepFocus(key: DateKey) {
    onJump(key)
    // 跳转后光标留在输入框
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/60 px-5 py-3 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight tabular-nums">
          {formatDate(selected)}
        </h1>
        <input
          ref={inputRef}
          type="text"
          defaultValue={formatInputHint(anchor)}
          placeholder="YYYY-MM 或 YYYYMMDD"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const key = parseDateInput((e.target as HTMLInputElement).value)
              if (key) handleJumpAndKeepFocus(key)
            }
          }}
          onBlur={(e) => {
            const key = parseDateInput(e.target.value)
            if (key) handleJumpAndKeepFocus(key)
          }}
          className="h-8 w-36 rounded-md border border-border bg-background px-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
        />
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

      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
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
