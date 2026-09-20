'use client'

import { useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { addDays, compareKey, todayKey, type DateKey } from '@/lib/date-utils'
import type { Holiday } from '@/lib/types'

interface HolidayDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  enabled: boolean
  holidays: Holiday[]
  onToggleEnabled: (enabled: boolean) => void
  onAdd: (start: DateKey, end: DateKey) => void
  onDelete: (id: string) => void
}

export function HolidayDialog({
  open,
  onOpenChange,
  enabled,
  holidays,
  onToggleEnabled,
  onAdd,
  onDelete,
}: HolidayDialogProps) {
  const [start, setStart] = useState<DateKey>(todayKey())
  const [end, setEnd] = useState<DateKey>(todayKey())
  const validRange = Boolean(start && end && compareKey(start, end) <= 0)
  const overlapInfo = useMemo(() => {
    if (!validRange) return null

    const touching = holidays.filter(
      (holiday) =>
        compareKey(holiday.start, addDays(end, 1)) <= 0 &&
        compareKey(start, addDays(holiday.end, 1)) <= 0,
    )
    if (touching.length === 0) return null

    const mergedStart = touching.reduce(
      (earliest, holiday) => compareKey(holiday.start, earliest) < 0 ? holiday.start : earliest,
      start,
    )
    const mergedEnd = touching.reduce(
      (latest, holiday) => compareKey(holiday.end, latest) > 0 ? holiday.end : latest,
      end,
    )
    const alreadyCovered = touching.some(
      (holiday) =>
        compareKey(holiday.start, start) <= 0 && compareKey(holiday.end, end) >= 0,
    )

    return { touchingCount: touching.length, mergedStart, mergedEnd, alreadyCovered }
  }, [end, holidays, start, validRange])

  useEffect(() => {
    if (!open) return

    const today = todayKey()
    setStart(today)
    setEnd((currentEnd) =>
      currentEnd && compareKey(currentEnd, today) >= 0 ? currentEnd : today,
    )
  }, [open])

  function handleStartChange(nextStart: DateKey) {
    setStart(nextStart)
    if (nextStart && end && compareKey(end, nextStart) < 0) {
      setEnd(nextStart)
    }
  }

  function handleEndChange(nextEnd: DateKey) {
    setEnd(nextEnd)
    if (nextEnd && start && compareKey(nextEnd, start) < 0) {
      setStart(nextEnd)
    }
  }

  function handleAdd() {
    if (!validRange || overlapInfo?.alreadyCovered) return
    onAdd(start, end)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[min(42rem,calc(100dvh-2rem))] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>假期模式</DialogTitle>
          <DialogDescription>
            假期模式开启后，周期任务与持续进度任务在假期区间内将隐藏，假期结束后自动恢复显示。日常任务与复习任务不受影响。
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 gap-4 overflow-y-auto overscroll-contain py-2 pr-1 [scrollbar-gutter:stable] sm:grid-cols-2 sm:overflow-hidden">
          <div className="flex flex-col gap-4 sm:min-h-0 sm:overflow-y-auto sm:overscroll-contain sm:pr-1 sm:[scrollbar-gutter:stable]">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">启用假期模式</p>
                <p className="text-xs text-muted-foreground">关闭后所有假期区间将不再生效</p>
              </div>
              <Switch checked={enabled} onCheckedChange={onToggleEnabled} />
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <Label>添加假期区间</Label>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">开始</span>
                <Input type="date" value={start} onChange={(e) => handleStartChange(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">结束</span>
                <Input type="date" value={end} onChange={(e) => handleEndChange(e.target.value)} />
              </div>
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!validRange || overlapInfo?.alreadyCovered}
                className="mt-1 w-full"
              >
                {overlapInfo?.alreadyCovered ? '该区间已存在' : '添加假期'}
              </Button>
              {overlapInfo && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {overlapInfo.alreadyCovered
                    ? '所选日期已包含在现有假期中，不会重复添加。'
                    : `将与 ${overlapInfo.touchingCount} 个重叠或相邻区间合并为 ${overlapInfo.mergedStart} ~ ${overlapInfo.mergedEnd}。`}
                </p>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col rounded-lg border border-border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
              <p className="text-sm font-medium">已设置的假期</p>
              <span className="text-xs tabular-nums text-muted-foreground">{holidays.length} 个区间</span>
            </div>
            {holidays.length === 0 ? (
              <div className="flex min-h-32 items-center justify-center px-3 text-xs text-muted-foreground">
                暂无假期区间
              </div>
            ) : (
              <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto overscroll-contain p-2 [scrollbar-gutter:stable] sm:max-h-none sm:min-h-0 sm:flex-1">
                {holidays
                  .slice()
                  .sort((a, b) => compareKey(a.start, b.start))
                  .map((h) => (
                    <div
                      key={h.id}
                      className="flex shrink-0 items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <span className="tabular-nums">
                        {h.start} ~ {h.end}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-red-500"
                        onClick={() => onDelete(h.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">删除假期</span>
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
