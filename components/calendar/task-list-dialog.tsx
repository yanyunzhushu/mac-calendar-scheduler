'use client'

import { useId, useState } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { fromKey, toKey } from '@/lib/date-utils'
import { typeColor } from '@/lib/status-visuals'
import type { Task, TaskType } from '@/lib/types'
import { TASK_TYPE_LABEL } from '@/lib/types'

interface TaskListDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tasks: Task[]
  onOpenTask: (taskId: string) => void
}

const TASK_TYPES: TaskType[] = ['single', 'recurring', 'ebbinghaus', 'progress', 'longterm']
const SELECT_CLASS = 'h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

function taskDateLabel(task: Task): string {
  const date = task.type === 'single' ? task.date : task.startDate
  // 遗留任务可能缺少日期，列表仍需允许找到并打开它们修正。
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || toKey(fromKey(date)) !== date) {
    return '未设置日期'
  }
  return task.type === 'single' ? date : `${date} 起`
}

export function TaskListDialog({ open, onOpenChange, tasks, onOpenTask }: TaskListDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-4 overflow-hidden sm:max-w-xl">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>全部任务</DialogTitle>
          <DialogDescription>查找历史、未来和已停止的任务，点击任务进行编辑。</DialogDescription>
        </DialogHeader>
        {/* 每次打开重新挂载筛选区，默认展示全部任务。 */}
        {open && (
          <TaskListContent
            tasks={tasks}
            onSelect={(taskId) => {
              onOpenChange(false)
              onOpenTask(taskId)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TaskListContent({ tasks, onSelect }: { tasks: Task[]; onSelect: (taskId: string) => void }) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState<TaskType | 'all'>('all')
  const [status, setStatus] = useState<'all' | 'active' | 'paused'>('all')
  const id = useId()
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const hasFilters = query.length > 0 || type !== 'all' || status !== 'all'
  const filteredTasks = tasks.filter((task) => (
    (task.name ?? '').toLocaleLowerCase().includes(normalizedQuery)
    && (type === 'all' || task.type === type)
    && (status === 'all' || (status === 'paused' ? !!task.paused : !task.paused))
  ))

  function clearFilters() {
    setQuery('')
    setType('all')
    setStatus('all')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="shrink-0 space-y-3">
        <div className="relative">
          <label className="sr-only" htmlFor={`${id}-search`}>搜索任务名称</label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id={`${id}-search`}
            type="search"
            className="h-9 pl-9"
            placeholder="搜索任务名称"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor={`${id}-type`} className="text-xs text-muted-foreground">任务类型</label>
            <select
              id={`${id}-type`}
              className={SELECT_CLASS}
              value={type}
              onChange={(event) => setType(event.target.value as TaskType | 'all')}
            >
              <option value="all">全部类型</option>
              {TASK_TYPES.map((taskType) => (
                <option key={taskType} value={taskType}>{TASK_TYPE_LABEL[taskType]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${id}-status`} className="text-xs text-muted-foreground">任务状态</label>
            <select
              id={`${id}-status`}
              className={SELECT_CLASS}
              value={status}
              onChange={(event) => setStatus(event.target.value as 'all' | 'active' | 'paused')}
            >
              <option value="all">全部状态</option>
              <option value="active">进行中</option>
              <option value="paused">已停止 / 暂停</option>
            </select>
          </div>
        </div>
        <div className="flex min-h-7 items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
            共 {tasks.length} 项任务，匹配 {filteredTasks.length} 项
          </p>
          {hasFilters && (
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFilters}>
              清除筛选
            </Button>
          )}
        </div>
      </div>

      <div className="-mx-1 min-h-0 overflow-y-auto px-1 pb-1">
        {tasks.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">还没有任务，可通过顶部“新建任务”添加。</p>
        ) : filteredTasks.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">没有符合条件的任务，请尝试其他名称或清除筛选条件。</p>
        ) : (
          <ul className="space-y-2" aria-label="任务列表">
            {filteredTasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onSelect(task.id)}
                >
                  <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: typeColor(task.type) }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{task.name || '未命名任务'}</span>
                      {task.paused && (
                        <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          {task.type === 'progress' ? '已暂停' : '已停止'}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>{TASK_TYPE_LABEL[task.type]}</span>
                      <span>· {taskDateLabel(task)}</span>
                    </span>
                    {task.description?.trim() && (
                      <span className="mt-1.5 block truncate text-xs text-muted-foreground">{task.description}</span>
                    )}
                  </span>
                  <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
