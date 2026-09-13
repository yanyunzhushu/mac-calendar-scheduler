'use client'

import { useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { TASK_TYPE_LABEL, type Task } from '@/lib/types'

interface TaskSearchProps {
  tasks: Task[]
  onOpenTask: (taskId: string) => void
}

function taskSearchText(task: Task): string {
  const stepNames = task.type === 'progress' ? task.steps.map((step) => step.name).join(' ') : ''
  return [task.name, task.description, TASK_TYPE_LABEL[task.type], taskDate(task), stepNames]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('zh-CN')
}

function taskDate(task: Task): string {
  return task.type === 'single' ? task.date : task.startDate
}

export function TaskSearch({ tasks, onOpenTask }: TaskSearchProps) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN')

  const results = useMemo(() => {
    if (!normalizedQuery) return []
    const keywords = normalizedQuery.split(/\s+/)
    return tasks.filter((task) => {
      const text = taskSearchText(task)
      return keywords.every((keyword) => text.includes(keyword))
    })
  }, [tasks, normalizedQuery])

  const open = focused && normalizedQuery.length > 0

  function selectTask(taskId: string) {
    onOpenTask(taskId)
    setQuery('')
    setFocused(false)
  }

  return (
    <div
      className="relative min-w-44 flex-1 sm:flex-none"
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocused(false)
        }
      }}
    >
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="text"
        role="searchbox"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setQuery('')
            inputRef.current?.blur()
          }
          if (event.key === 'Enter' && results.length === 1) {
            selectTask(results[0].id)
          }
        }}
        placeholder="搜索任务"
        aria-label="搜索任务"
        aria-expanded={open}
        className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-8 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring sm:w-48"
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery('')
            inputRef.current?.focus()
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="清空搜索"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-80 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">没有匹配的任务</p>
          ) : (
            <>
              <div className="macos-scroll max-h-80 overflow-y-auto p-1.5">
                {results.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => selectTask(task.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{task.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {TASK_TYPE_LABEL[task.type]} · {taskDate(task)}
                        {task.paused ? ' · 已停止' : ''}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <p className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
                找到 {results.length} 项
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
