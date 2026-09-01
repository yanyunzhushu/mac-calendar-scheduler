'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AppState, Holiday, ProgressTask, Task } from './types'

const STORAGE_KEY = 'calendar-app-state'

function createId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

/** 计算回收站自动删除时间（隔天24点） */
function computeExpiresAt(deletedAt: number): number {
  const d = new Date(deletedAt)
  d.setDate(d.getDate() + 2) // 后天凌晨0点 = 隔天24点
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const EMPTY_STATE: AppState = {
  tasks: [],
  holidays: [],
  holidayModeEnabled: false,
  groups: [],
  themes: [],
  trash: [],
}

/** 从 localStorage 读取状态，失败时返回空状态 */
function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (Array.isArray(parsed.tasks) && Array.isArray(parsed.holidays)) {
        return {
          ...parsed,
          groups: Array.isArray(parsed.groups) ? parsed.groups : [],
          themes: Array.isArray(parsed.themes) ? parsed.themes : [],
          trash: Array.isArray(parsed.trash) ? parsed.trash : [],
        }
      }
    }
  } catch (e) {
    console.error('从 localStorage 加载数据失败:', e)
  }
  return EMPTY_STATE
}

export function useAppState() {
  const [state, setState] = useState<AppState>(EMPTY_STATE)
  const [loaded, setLoaded] = useState(false)

  // 初始化：从 localStorage 加载
  useEffect(() => {
    const saved = loadState()

    // 清理已过期的回收站项目
    const now = Date.now()
    if (saved.trash && saved.trash.length > 0) {
      saved.trash = saved.trash.filter((t) => t.expiresAt > now)
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

  // 定期清理过期回收站项目（每 2 分钟检查一次）
  useEffect(() => {
    if (!loaded) return
    const interval = setInterval(() => {
      setState((prev) => {
        const now = Date.now()
        const validTrash = prev.trash.filter((t) => t.expiresAt > now)
        if (validTrash.length === prev.trash.length) return prev
        return { ...prev, trash: validTrash }
      })
    }, 120000)
    return () => clearInterval(interval)
  }, [loaded])

  const addTask = useCallback(
    (task: Omit<Task, 'id' | 'createdAt' | 'completions'>) => {
      const newTask = { ...task, id: createId(), createdAt: Date.now(), completions: {} } as Task
      // 进度任务默认值
      if (newTask.type === 'progress') {
        newTask.steps ??= []
        newTask.dailyCompletions ??= {}
        newTask.startStepIndex ??= 0
      }
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
    setState((prev) => {
      const task = prev.tasks.find((t) => t.id === id)
      if (!task) return prev

      // 如果任务属于某个分组，删除该组所有任务
      let idsToDelete: string[]
      if (task.groupId) {
        idsToDelete = prev.tasks
          .filter((t) => t.groupId === task.groupId)
          .map((t) => t.id)
      } else {
        idsToDelete = [id]
      }

      const now = Date.now()
      const expiresAt = computeExpiresAt(now)

      const newTrash = idsToDelete
        .map((tid) => prev.tasks.find((t) => t.id === tid))
        .filter(Boolean)
        .map((t) => ({ task: t!, deletedAt: now, expiresAt }))

      return {
        ...prev,
        tasks: prev.tasks.filter((t) => !idsToDelete.includes(t.id)),
        trash: [...prev.trash, ...newTrash],
      }
    })
  }, [])

  const restoreTask = useCallback((taskId: string) => {
    setState((prev) => {
      const trashed = prev.trash.find((t) => t.task.id === taskId)
      if (!trashed) return prev

      // 如果被删任务有分组，恢复该组所有回收站中的任务
      let idsToRestore: string[]
      if (trashed.task.groupId) {
        idsToRestore = prev.trash
          .filter((t) => t.task.groupId === trashed.task.groupId)
          .map((t) => t.task.id)
      } else {
        idsToRestore = [taskId]
      }

      const restored = idsToRestore
        .map((tid) => prev.trash.find((t) => t.task.id === tid)?.task)
        .filter(Boolean) as Task[]

      return {
        ...prev,
        tasks: [...prev.tasks, ...restored],
        trash: prev.trash.filter((t) => !idsToRestore.includes(t.task.id)),
      }
    })
  }, [])

  const permanentlyDeleteTask = useCallback((taskId: string) => {
    setState((prev) => ({
      ...prev,
      trash: prev.trash.filter((t) => t.task.id !== taskId),
    }))
  }, [])

  const emptyTrash = useCallback(() => {
    setState((prev) => ({ ...prev, trash: [] }))
  }, [])

  const addGroup = useCallback((name: string) => {
    const id = createId()
    setState((prev) => ({
      ...prev,
      groups: [...prev.groups, { id, name, createdAt: Date.now() }],
    }))
    return id
  }, [])

  const deleteGroup = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.filter((g) => g.id !== id),
      // 移除已删除组中所有任务的 groupId
      tasks: prev.tasks.map((t) =>
        t.groupId === id ? ({ ...t, groupId: undefined } as Task) : t,
      ),
    }))
  }, [])

  const completeInstance = useCallback((taskId: string, date: string) => {
    setState((prev) => {
      const task = prev.tasks.find((t) => t.id === taskId)
      if (!task) return prev
      if (task.type === 'progress') {
        // 进度任务：累加 dailyCompletions[date]（支持链式完成）
        const pt = task as ProgressTask
        const dc = { ...pt.dailyCompletions }
        dc[date] = (dc[date] || 0) + 1
        return {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === taskId ? { ...pt, dailyCompletions: dc } as Task : t,
          ),
        }
      }
if ((task.type === 'single' || task.type === 'recurring') && (task as any).countingMode) {
        // 计数模式：completions[date] 存储完成次数
        const count = (task.completions[date] ?? 0) + 1
        const updated = { ...task, completions: { ...task.completions, [date]: count } } as Task
        return { ...prev, tasks: prev.tasks.map((t) => (t.id === taskId ? updated : t)) }
      }
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
      if (task.type === 'progress') {
        // 进度任务：递减 dailyCompletions[date]
        const pt = task as ProgressTask
        const dc = { ...pt.dailyCompletions }
        const cur = dc[date] || 0
        if (cur > 1) {
          // 链式完成仍有剩余次数：递减，仍视为已完成
          dc[date] = cur - 1
        } else {
          // 完成记录清空（cur 为 0 或 1）：删除记录，该日变回可补做
          delete dc[date]
        }
        return {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === taskId ? { ...pt, dailyCompletions: dc } as Task : t,
          ),
        }
      }
if ((task.type === 'single' || task.type === 'recurring') && (task as any).countingMode) {
        // 计数模式：递减计数器，减到 0 则清除
        const count = (task.completions[date] ?? 0) - 1
        const nextCompletions = { ...task.completions }
        if (count <= 0) { delete nextCompletions[date] }
        else { nextCompletions[date] = count }
        const updated = { ...task, completions: nextCompletions } as Task
        return { ...prev, tasks: prev.tasks.map((t) => (t.id === taskId ? updated : t)) }
      }
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

  const createTheme = useCallback((name: string) => {
    const id = createId()
    setState((prev) => ({
      ...prev,
      themes: [...prev.themes, { id, name, createdAt: Date.now() }],
    }))
    return id
  }, [])

  const deleteTheme = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      themes: prev.themes.filter((t) => t.id !== id),
      tasks: prev.tasks.map((t) =>
        t.themeId === id ? ({ ...t, themeId: undefined } as Task) : t,
      ),
    }))
  }, [])

  return {
    state,
    loaded,
    addTask,
    updateTask,
    deleteTask,
    restoreTask,
    permanentlyDeleteTask,
    emptyTrash,
    addGroup,
    deleteGroup,
    completeInstance,
    uncompleteInstance,
    togglePause,
    setHolidayModeEnabled,
    addHoliday,
    deleteHoliday,
    createTheme,
    deleteTheme,
  }
}

export type AppStateHook = ReturnType<typeof useAppState>
export type { Holiday, TaskGroup, TrashItem, Theme } from './types'
