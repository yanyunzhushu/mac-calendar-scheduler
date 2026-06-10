'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatLong, type DateKey } from '@/lib/date-utils'
import type { Holiday, TaskInstance } from '@/lib/types'
import { findHoliday } from '@/lib/task-engine'
import { InstanceItem } from './instance-item'

interface DaySidebarProps {
  selected: DateKey
  today: DateKey
  instances: TaskInstance[]
  holidays: Holiday[]
  onComplete: (taskId: string, date: DateKey) => void
  onUncomplete: (taskId: string, date: DateKey) => void
  onOpenTask: (taskId: string) => void
  onCreate: () => void
}

export function DaySidebar({
  selected,
  today,
  instances,
  holidays,
  onComplete,
  onUncomplete,
  onOpenTask,
  onCreate,
}: DaySidebarProps) {
  const holiday = findHoliday(selected, holidays)
  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-card/40">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground">已选日期</p>
            <h2 className="text-balance text-sm font-semibold leading-snug">
              {formatLong(selected)}
            </h2>
          </div>
          {selected === today && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
              今天
            </span>
          )}
        </div>
      </div>

      <div className="macos-scroll flex-1 overflow-y-auto p-4">
        {holiday && (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            假期期间，持续进度任务暂停推进
          </div>
        )}
        {instances.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">这一天没有安排任务</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {instances.map((inst, i) => (
              <InstanceItem
                key={`${inst.taskId}-${i}`}
                inst={inst}
                onComplete={() => onComplete(inst.taskId, inst.date)}
                onUncomplete={() => onUncomplete(inst.taskId, inst.date)}
                onOpenTask={() => onOpenTask(inst.taskId)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border p-4">
        <Button className="w-full gap-2" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          为这一天新建任务
        </Button>
      </div>
    </aside>
  )
}
