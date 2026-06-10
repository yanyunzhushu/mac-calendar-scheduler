'use client'

import { useState } from 'react'
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
import { compareKey, todayKey, type DateKey } from '@/lib/date-utils'
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

  function handleAdd() {
    if (!start || !end) return
    const s = compareKey(start, end) <= 0 ? start : end
    const e = compareKey(start, end) <= 0 ? end : start
    onAdd(s, e)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>假期模式</DialogTitle>
          <DialogDescription>
            假期期间，持续进度任务暂停推进，截止日自动顺延到假期结束后。周期任务与艾宾浩斯复习不受影响。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">启用假期模式</p>
              <p className="text-xs text-muted-foreground">关闭后所有假期区间将不再生效</p>
            </div>
            <Switch checked={enabled} onCheckedChange={onToggleEnabled} />
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <Label>添加假期区间</Label>
            <div className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-xs text-muted-foreground">开始</span>
                <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-xs text-muted-foreground">结束</span>
                <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
            <Button size="sm" onClick={handleAdd} className="mt-1 self-start">
              添加
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">已设置的假期</p>
            {holidays.length === 0 ? (
              <p className="text-xs text-muted-foreground">暂无假期区间</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {holidays
                  .slice()
                  .sort((a, b) => compareKey(a.start, b.start))
                  .map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
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
