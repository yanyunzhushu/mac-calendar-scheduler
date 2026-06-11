'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AppState, Holiday, Task } from './types'

const STORAGE_KEY = 'calendar-app-state'

function createId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

const EMPTY_STATE: AppState = {
  tasks: [],
  holidays: [],
  holidayModeEnabled: false,
}

/** 从 localStorage 读取状态，失败时返回空状态 */
function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (Array.isArray(parsed.tasks) && Array.isArray(parsed.holidays)) {
        return parsed
      }
    }
  } catch (e) {
    console.error('从 localStorage 加载数据失败:', e)
  }
  return EMPTY_STATE
}

function todayKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 首次运行时创建示例任务 */
function createSeedTasks(): Task[] {
  const today = todayKey()
  const now = Date.now()
  return [
    {
      id: createId(),
      type: 'recurring',
      name: '每日晨间锻炼',
      description: '30 分钟有氧运动',
      createdAt: now,
      completions: {},
      startDate: today,
      freq: 'daily',
      interval: 1,
      end: { type: 'never' },
    },
    {
      id: createId(),
      type: 'ebbinghaus',
      name: '背诵英语单词 Unit 5',
      description: '艾宾浩斯遗忘曲线复习',
      createdAt: now,
      completions: {},
      startDate: today,
      intervals: [0, 1, 2, 4, 7, 15, 30],
      end: { type: 'never' },
    },
    {
      id: createId(),
      type: 'progress',
      name: '每 3 天读一篇论文',
      description: '持续推进的阅读计划',
      createdAt: now,
      completions: {},
      startDate: today,
      interval: 3,
    },
    {
      id: createId(),
      type: 'recurring',
      name: '阅读半小时',
      description: '每天读书半小时',
      createdAt: now,
      completions: {},
      startDate: today,
      freq: 'daily',
      interval: 1,
      end: { type: 'never' },
    },
    {
      id: createId(),
      type: 'progress',
      name: '每周总结',
      description: '记录一周的工作和学习',
      createdAt: now,
      completions: {},
      startDate: today,
      interval: 7,
    },
  ]
}

export function useAppState() {
  const [state, setState] = useState<AppState>(EMPTY_STATE)
  const [loaded, setLoaded] = useState(false)

  // 初始化：从 localStorage 加载，首次使用则填充示例任务
  useEffect(() => {
    const saved = loadState()
    if (saved.tasks.length === 0 && saved.holidays.length === 0) {
      // 首次使用：填充示例数据
      saved.tasks = createSeedTasks()
    }
    setState(saved)
    setLoaded(true)
  }, [])

  // 每次 state 变化时自动持久化到 localStorage
  useEffect(() => {
    if (loaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch (e) {
        console.error('持久化到 localStorage 失败:', e)
      }
    }
  }, [state, loaded])

  const addTask = useCallback(
    (task: Omit<Task, 'id' | 'createdAt' | 'completions'>) => {
      const newTask = { ...task, id: createId(), createdAt: Date.now(), completions: {} } as Task
      setState((prev) => ({ ...prev, tasks: [...prev.tasks, newTask] }))
    },
    [],
  )

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setState((prev) => {
      const task = prev.tasks.find((t) => t.id === id)
      if (!task) return prev
      const updated = { ...task, ...updates } as Task
      return { ...prev, tasks: prev.tasks.map((t) => (t.id === id ? updated : t)) }
    })
  }, [])

  const deleteTask = useCallback((id: string) => {
    setState((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== id) }))
  }, [])

  const completeInstance = useCallback((taskId: string, date: string) => {
    setState((prev) => {
      const task = prev.tasks.find((t) => t.id === taskId)
      if (!task) return prev
      const updated = {
        ...task,
        completions: { ...task.completions, [date]: Date.now() },
      } as Task
      return { ...prev, tasks: prev.tasks.map((t) => (t.id === taskId ? updated : t)) }
    })
  }, [])

  const uncompleteInstance = useCallback((taskId: string, date: string) => {
    setState((prev) => {
      const task = prev.tasks.find((t) => t.id === taskId)
      if (!task) return prev
      const next = { ...task.completions }
      delete next[date]
      const updated = { ...task, completions: next } as Task
      return { ...prev, tasks: prev.tasks.map((t) => (t.id === taskId ? updated : t)) }
    })
  }, [])

  const togglePause = useCallback((taskId: string) => {
    setState((prev) => {
      const task = prev.tasks.find((t) => t.id === taskId)
      if (!task) return prev
      const updated = { ...task, paused: !task.paused } as Task
      return { ...prev, tasks: prev.tasks.map((t) => (t.id === taskId ? updated : t)) }
    })
  }, [])

  const setHolidayModeEnabled = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, holidayModeEnabled: enabled }))
  }, [])

  const addHoliday = useCallback((start: string, end: string) => {
    const holiday: Holiday = { id: createId(), start, end }
    setState((prev) => ({ ...prev, holidays: [...prev.holidays, holiday] }))
  }, [])

  const deleteHoliday = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      holidays: prev.holidays.filter((h) => h.id !== id),
    }))
  }, [])

  return {
    state,
    loaded,
    addTask,
    updateTask,
    deleteTask,
    completeInstance,
    uncompleteInstance,
    togglePause,
    setHolidayModeEnabled,
    addHoliday,
    deleteHoliday,
  }
}

export type AppStateHook = ReturnType<typeof useAppState>
export type { Holiday }
