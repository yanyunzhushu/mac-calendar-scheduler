'use client'

import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatLong, type DateKey } from '@/lib/date-utils'
import type { Holiday, Task, TaskInstance } from '@/lib/types'
import { findHoliday } from '@/lib/task-engine'
import { InstanceItem } from './instance-item'

interface DaySidebarProps {
  selected: DateKey
  today: DateKey
  instances: TaskInstance[]
  tasks: Task[]
  holidays: Holiday[]
  onComplete: (taskId: string, date: DateKey) => void
  onUncomplete: (taskId: string, date: DateKey) => void
  onUndoSkip?: (taskId: string, undoDate: string) => void
  onOpenTask: (taskId: string) => void
  onFocusTask?: (taskId: string) => void
  onTogglePause?: (taskId: string) => void
  focusedTaskId?: string | null
  onClearFocus?: () => void
  onCreate: () => void
}

export function DaySidebar({
  selected,
  today,
  instances,
  tasks,
  holidays,
  onComplete,
  onUncomplete,
  onUndoSkip,
  onOpenTask,
  onFocusTask,
  onTogglePause,
  focusedTaskId,
  onClearFocus,
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
          <div className="flex items-center gap-1">
            {focusedTaskId && onClearFocus && (
              <button
                type="button"
                onClick={onClearFocus}
                className="flex items-center gap-1 rounded-md bg-red-500 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-red-600"
              >
                <X className="h-3.5 w-3.5" />
                退出任务视图
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="macos-scroll flex-1 overflow-y-auto p-4">
        {holiday && (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            假期期间，周期任务与持续进度任务不显示
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
                task={tasks.find((t) => t.id === inst.taskId)}
                onComplete={() => onComplete(inst.taskId, inst.date)}
                onUncomplete={() => onUncomplete(inst.taskId, inst.date)}
                onUndoSkip={onUndoSkip ? (undoDate) => onUndoSkip(inst.taskId, undoDate) : undefined}
                onOpenTask={() => onOpenTask(inst.taskId)}
                onFocusTask={onFocusTask}
                onTogglePause={onTogglePause}
                isFocused={focusedTaskId === inst.taskId}
                focusedTaskId={focusedTaskId}
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
