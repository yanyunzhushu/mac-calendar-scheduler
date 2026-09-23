'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { DateKey } from '@/lib/date-utils'
import type { Task, TaskInstance } from '@/lib/types'
import { InstanceItem } from './instance-item'

type SectionKey = 'pending' | 'completed' | 'reminders' | 'future' | 'inactive' | 'holiday'

const SECTIONS: { key: SectionKey; label: string; collapsible: boolean }[] = [
  { key: 'pending', label: '待处理', collapsible: false },
  { key: 'completed', label: '已完成', collapsible: true },
  { key: 'reminders', label: '长期提醒', collapsible: true },
  { key: 'future', label: '未来安排', collapsible: true },
  { key: 'inactive', label: '已停止 / 暂停', collapsible: true },
  { key: 'holiday', label: '假期暂停', collapsible: true },
]

export function getTaskSection(inst: TaskInstance, task: Task | undefined, today: DateKey): SectionKey {
  // 终止/暂停优先于完成状态，历史记录保留在此区但不计入每日完成比例。
  if (task?.paused || inst.status === 'stopped') return 'inactive'
  if (inst.status === 'future' || inst.date > today) return 'future'
  if (inst.taskType === 'longterm' || inst.status === 'reminder') return 'reminders'
  if (inst.status === 'holiday') return 'holiday'
  // 今天可重复完成的任务保留原位，历史日期仍归入已完成。
  if (inst.status === 'completed') {
    const repeatable = task?.type === 'progress' ||
      ((task?.type === 'single' || task?.type === 'recurring') && task.countingMode)
    return inst.date === today && repeatable ? 'pending' : 'completed'
  }
  return 'pending'
}

export function getTaskCompletionSummary(instances: TaskInstance[], tasks: Task[], today: DateKey) {
  const tasksById = new Map(tasks.map((task) => [task.id, task]))
  const eligible = new Map<string, boolean>()
  for (const inst of instances) {
    const section = getTaskSection(inst, tasksById.get(inst.taskId), today)
    if (section !== 'pending' && section !== 'completed') continue
    // 同一任务同日完成多次仍是一项任务，不把次数当作完成项数。
    const key = `${inst.taskId}:${inst.date}`
    eligible.set(key, !!eligible.get(key) || inst.status === 'completed')
  }
  return { completed: [...eligible.values()].filter(Boolean).length, total: eligible.size }
}

export function TaskCompletionSummary({ instances, tasks, today }: {
  instances: TaskInstance[]
  tasks: Task[]
  today: DateKey
}) {
  const { completed, total } = getTaskCompletionSummary(instances, tasks, today)
  return (
    <p
      className="mt-1.5 text-xs text-muted-foreground"
      role="status"
      aria-live="polite"
      title="按任务项计数，不含长期提醒、未来安排和已停止或暂停的任务"
    >
      已完成 <span className="font-medium tabular-nums text-foreground">{completed} / {total}</span> 项
    </p>
  )
}

interface TaskSectionsProps {
  today: DateKey
  instances: TaskInstance[]
  tasks: Task[]
  onComplete: (taskId: string, date: DateKey) => void
  onUncomplete: (taskId: string, date: DateKey) => void
  onToggleAck?: (taskId: string, date: DateKey) => void
  onOpenTask: (taskId: string) => void
  onFocusTask?: (taskId: string) => void
  onTogglePause?: (taskId: string) => void
  focusedTaskId?: string | null
}

export function TaskSections({
  today,
  instances,
  tasks,
  onComplete,
  onUncomplete,
  onToggleAck,
  onOpenTask,
  onFocusTask,
  onTogglePause,
  focusedTaskId,
}: TaskSectionsProps) {
  const id = useId()
  const focusedItemRef = useRef<HTMLDivElement>(null)
  // 已完成默认展开，使持续进度任务的“再完成一次”始终有明确入口。
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    pending: true,
    completed: true,
    reminders: true,
    future: true,
    inactive: false,
    holiday: false,
  })
  const tasksById = new Map(tasks.map((task) => [task.id, task]))
  const grouped: Record<SectionKey, TaskInstance[]> = {
    pending: [], completed: [], reminders: [], future: [], inactive: [], holiday: [],
  }
  for (const inst of instances) grouped[getTaskSection(inst, tasksById.get(inst.taskId), today)].push(inst)
  const focusedInstance = instances.find((inst) => inst.taskId === focusedTaskId)
  const focusedSection = focusedInstance && getTaskSection(focusedInstance, tasksById.get(focusedInstance.taskId), today)

  useEffect(() => {
    if (focusedTaskId) focusedItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [focusedTaskId, focusedSection])

  return (
    <div className="flex flex-col gap-4">
      {SECTIONS.map(({ key, label, collapsible }) => {
        const rows = grouped[key]
        if (rows.length === 0) return null
        const hasFocused = key === focusedSection
        const isExpanded = !collapsible || hasFocused || expanded[key]
        const contentId = `${id}-${key}`
        return (
          <section key={key} aria-labelledby={`${contentId}-heading`}>
            <h3 id={`${contentId}-heading`} className="mb-2 text-xs font-medium text-muted-foreground">
              {collapsible ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-1.5 rounded py-1 text-left hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
                  aria-expanded={isExpanded}
                  aria-controls={contentId}
                  disabled={hasFocused}
                  title={hasFocused ? '任务视图中保持展开' : undefined}
                  onClick={() => setExpanded((current) => ({ ...current, [key]: !current[key] }))}
                >
                  {isExpanded ? <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" /> : <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />}
                  <span>{label}</span>
                  <span className="tabular-nums">{rows.length}</span>
                </button>
              ) : (
                <span className="flex items-center gap-1.5 py-1"><span>{label}</span><span className="tabular-nums">{rows.length}</span></span>
              )}
            </h3>
            <div id={contentId} hidden={!isExpanded} className={isExpanded ? 'flex flex-col gap-2.5' : 'hidden'}>
              {rows.map((inst, index) => (
                <div key={`${inst.taskId}-${inst.date}-${index}`} ref={focusedTaskId === inst.taskId ? focusedItemRef : undefined}>
                  <InstanceItem
                    inst={inst}
                    task={tasksById.get(inst.taskId)}
                    today={today}
                    onComplete={() => onComplete(inst.taskId, inst.date)}
                    onUncomplete={() => onUncomplete(inst.taskId, inst.date)}
                    onToggleAck={onToggleAck}
                    onOpenTask={() => onOpenTask(inst.taskId)}
                    onFocusTask={onFocusTask}
                    onTogglePause={onTogglePause}
                    isFocused={focusedTaskId === inst.taskId}
                    focusedTaskId={focusedTaskId}
                  />
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
