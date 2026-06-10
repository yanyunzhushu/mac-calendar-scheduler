'use client'

import { useCallback, useEffect, useState } from 'react'
import { todayKey } from './date-utils'
import type { AppState, Holiday, Task } from './types'

const STORAGE_KEY = 'calendar-scheduler-state-v1'

function createId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

const EMPTY_STATE: AppState = {
  tasks: [],
  holidays: [],
  holidayModeEnabled: false,
}

/** 首次加载时填充一些示例任务，方便用户立即看到效果 */
function createSeedState(): AppState {
  const t = todayKey()
  const id1 = createId()
  const id2 = createId()
  const id3 = createId()
  return {
    holidayModeEnabled: false,
    holidays: [],
    tasks: [
      {
        id: id1,
        type: 'recurring',
        name: '每日晨间锻炼',
        description: '30 分钟有氧运动',
        createdAt: Date.now(),
        completions: {},
        startDate: t,
        freq: 'daily',
        interval: 1,
        end: { type: 'never' },
      },
      {
        id: id2,
        type: 'ebbinghaus',
        name: '背诵英语单词 Unit 5',
        description: '艾宾浩斯遗忘曲线复习',
        createdAt: Date.now(),
        completions: {},
        startDate: t,
        intervals: [0, 1, 2, 4, 7, 15, 30],
        end: { type: 'never' },
      },
      {
        id: id3,
        type: 'progress',
        name: '每 3 天读一篇论文',
        description: '持续推进的阅读计划',
        createdAt: Date.now(),
        completions: {},
        startDate: t,
        interval: 3,
      },
    ],
  }
}

export function useAppState() {
  const [state, setState] = useState<AppState>(EMPTY_STATE)
  const [loaded, setLoaded] = useState(false)

  // 初始化：从 localStorage 读取
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as AppState
        setState({
          tasks: parsed.tasks ?? [],
          holidays: parsed.holidays ?? [],
          holidayModeEnabled: parsed.holidayModeEnabled ?? false,
        })
      } else {
        setState(createSeedState())
      }
    } catch {
      setState(createSeedState())
    }
    setLoaded(true)
  }, [])

  // 持久化
  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // 忽略写入失败
    }
  }, [state, loaded])

  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt' | 'completions'>) => {
    setState((prev) => ({
      ...prev,
      tasks: [
        ...prev.tasks,
        { ...task, id: createId(), createdAt: Date.now(), completions: {} } as Task,
      ],
    }))
  }, [])

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === id ? ({ ...t, ...updates } as Task) : t)),
    }))
  }, [])

  const deleteTask = useCallback((id: string) => {
    setState((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== id) }))
  }, [])

  /** 标记某任务在某日期完成 */
  const completeInstance = useCallback((taskId: string, date: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === taskId
          ? { ...t, completions: { ...t.completions, [date]: Date.now() } }
          : t,
      ),
    }))
  }, [])

  /** 取消某任务在某日期的完成 */
  const uncompleteInstance = useCallback((taskId: string, date: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => {
        if (t.id !== taskId) return t
        const next = { ...t.completions }
        delete next[date]
        return { ...t, completions: next }
      }),
    }))
  }, [])

  const togglePause = useCallback((taskId: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, paused: !t.paused } : t)),
    }))
  }, [])

  const setHolidayModeEnabled = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, holidayModeEnabled: enabled }))
  }, [])

  const addHoliday = useCallback((start: string, end: string) => {
    setState((prev) => ({
      ...prev,
      holidays: [...prev.holidays, { id: createId(), start, end }],
    }))
  }, [])

  const deleteHoliday = useCallback((id: string) => {
    setState((prev) => ({ ...prev, holidays: prev.holidays.filter((h) => h.id !== id) }))
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
