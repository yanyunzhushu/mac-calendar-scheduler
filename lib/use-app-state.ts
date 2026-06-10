'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AppState, Holiday, Task } from './types'

function createId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

const EMPTY_STATE: AppState = {
  tasks: [],
  holidays: [],
  holidayModeEnabled: false,
}

export function useAppState() {
  const [state, setState] = useState<AppState>(EMPTY_STATE)
  const [loaded, setLoaded] = useState(false)

  // 初始化：从后端 API 加载全部数据
  useEffect(() => {
    async function load() {
      try {
        const [tasksRes, holidaysRes, configRes] = await Promise.all([
          fetch('/api/tasks'),
          fetch('/api/holidays'),
          fetch('/api/config'),
        ])
        const tasks: Task[] = await tasksRes.json()
        const holidays: Holiday[] = await holidaysRes.json()
        const config = await configRes.json()
        setState({
          tasks: tasks ?? [],
          holidays: holidays ?? [],
          holidayModeEnabled: config.holidayModeEnabled ?? false,
        })
      } catch (e) {
        console.error('从后端加载数据失败（服务器可能未启动）:', e)
        setState(EMPTY_STATE)
      }
      setLoaded(true)
    }
    load()
  }, [])

  // 以下操作为"乐观更新"：先改本地状态让 UI 立即响应，
  // 再异步发请求让后端持久化；请求失败只打印日志不影响使用。

  const addTask = useCallback(
    (task: Omit<Task, 'id' | 'createdAt' | 'completions'>) => {
      const newTask = { ...task, id: createId(), createdAt: Date.now(), completions: {} } as Task
      fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      }).catch((e) => console.error('POST /api/tasks 失败:', e))
      setState((prev) => ({ ...prev, tasks: [...prev.tasks, newTask] }))
    },
    [],
  )

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setState((prev) => {
      const task = prev.tasks.find((t) => t.id === id)
      if (!task) return prev
      const updated = { ...task, ...updates } as Task
      fetch('/api/tasks/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      }).catch((e) => console.error('PUT /api/tasks/:id 失败:', e))
      return { ...prev, tasks: prev.tasks.map((t) => (t.id === id ? updated : t)) }
    })
  }, [])

  const deleteTask = useCallback((id: string) => {
    setState((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== id) }))
    fetch('/api/tasks/' + id, { method: 'DELETE' }).catch((e) =>
      console.error('DELETE /api/tasks/:id 失败:', e),
    )
  }, [])

  const completeInstance = useCallback((taskId: string, date: string) => {
    setState((prev) => {
      const task = prev.tasks.find((t) => t.id === taskId)
      if (!task) return prev
      const updated = {
        ...task,
        completions: { ...task.completions, [date]: Date.now() },
      } as Task
      fetch('/api/tasks/' + taskId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      }).catch((e) => console.error('PUT /api/tasks/:id (complete) 失败:', e))
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
      fetch('/api/tasks/' + taskId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      }).catch((e) => console.error('PUT /api/tasks/:id (uncomplete) 失败:', e))
      return { ...prev, tasks: prev.tasks.map((t) => (t.id === taskId ? updated : t)) }
    })
  }, [])

  const togglePause = useCallback((taskId: string) => {
    setState((prev) => {
      const task = prev.tasks.find((t) => t.id === taskId)
      if (!task) return prev
      const updated = { ...task, paused: !task.paused } as Task
      fetch('/api/tasks/' + taskId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      }).catch((e) => console.error('PUT /api/tasks/:id (pause) 失败:', e))
      return { ...prev, tasks: prev.tasks.map((t) => (t.id === taskId ? updated : t)) }
    })
  }, [])

  const setHolidayModeEnabled = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, holidayModeEnabled: enabled }))
    fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holidayModeEnabled: enabled }),
    }).catch((e) => console.error('PUT /api/config 失败:', e))
  }, [])

  const addHoliday = useCallback((start: string, end: string) => {
    const holiday: Holiday = { id: createId(), start, end }
    setState((prev) => ({ ...prev, holidays: [...prev.holidays, holiday] }))
    fetch('/api/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(holiday),
    }).catch((e) => console.error('POST /api/holidays 失败:', e))
  }, [])

  const deleteHoliday = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      holidays: prev.holidays.filter((h) => h.id !== id),
    }))
    fetch('/api/holidays/' + id, { method: 'DELETE' }).catch((e) =>
      console.error('DELETE /api/holidays/:id 失败:', e),
    )
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
