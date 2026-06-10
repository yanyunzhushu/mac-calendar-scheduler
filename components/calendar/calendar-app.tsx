'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  addDays,
  addMonths,
  getMonthGrid,
  getWeekDays,
  todayKey,
  type DateKey,
} from '@/lib/date-utils'
import { useAppState } from '@/lib/use-app-state'
import { buildInstanceMap, countTodayMissed } from '@/lib/task-engine'
import type { Holiday, Task } from '@/lib/types'
import { CalendarHeader, type ViewMode } from './calendar-header'
import { MonthView } from './month-view'
import { WeekView } from './week-view'
import { DayView } from './day-view'
import { DaySidebar } from './day-sidebar'
import { TaskForm } from './task-form'
import { HolidayDialog } from './holiday-dialog'
import { Legend } from './legend'

export function CalendarApp() {
  const {
    state,
    loaded,
    addTask,
    updateTask,
    deleteTask,
    completeInstance,
    uncompleteInstance,
    setHolidayModeEnabled,
    addHoliday,
    deleteHoliday,
  } = useAppState()

  const today = todayKey()
  const [view, setView] = useState<ViewMode>('month')
  const [anchor, setAnchor] = useState<DateKey>(today)
  const [selected, setSelected] = useState<DateKey>(today)
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [holidayOpen, setHolidayOpen] = useState(false)

  // 仅在假期模式开启时，假期才生效
  const activeHolidays: Holiday[] = state.holidayModeEnabled ? state.holidays : []

  // 计算当前视图的日期范围
  const [rangeStart, rangeEnd] = useMemo<[DateKey, DateKey]>(() => {
    if (view === 'month') {
      const grid = getMonthGrid(anchor)
      return [grid[0], grid[grid.length - 1]]
    }
    if (view === 'week') {
      const days = getWeekDays(anchor)
      return [days[0], days[days.length - 1]]
    }
    return [anchor, anchor]
  }, [view, anchor])

  const instanceMap = useMemo(
    () => buildInstanceMap(state.tasks, activeHolidays, rangeStart, rangeEnd, today),
    [state.tasks, activeHolidays, rangeStart, rangeEnd, today],
  )

  // 选中日的实例（单独按选中日计算，确保日/周/月视图一致）
  const selectedInstances = useMemo(() => {
    const map = buildInstanceMap(state.tasks, activeHolidays, selected, selected, today)
    return (map[selected] ?? []).sort((a, b) => a.taskType.localeCompare(b.taskType))
  }, [state.tasks, activeHolidays, selected, today])

  const todayMissed = useMemo(
    () => countTodayMissed(state.tasks, activeHolidays, today),
    [state.tasks, activeHolidays, today],
  )

  function handleSelect(key: DateKey) {
    setSelected(key)
    if (view === 'day') setAnchor(key)
  }

  function navigate(dir: -1 | 1) {
    if (view === 'month') setAnchor((a) => addMonths(a, dir))
    else if (view === 'week') setAnchor((a) => addDays(a, dir * 7))
    else {
      const next = addDays(anchor, dir)
      setAnchor(next)
      setSelected(next)
    }
  }

  function goToday() {
    setAnchor(today)
    setSelected(today)
  }

  function openCreate() {
    setEditingTask(null)
    setFormOpen(true)
  }

  function openEdit(taskId: string) {
    const task = state.tasks.find((t) => t.id === taskId) ?? null
    setEditingTask(task)
    setFormOpen(true)
  }

  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        加载中…
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-muted/20">
      <CalendarHeader
        view={view}
        anchor={anchor}
        holidayEnabled={state.holidayModeEnabled}
        onViewChange={setView}
        onPrev={() => navigate(-1)}
        onNext={() => navigate(1)}
        onToday={goToday}
        onOpenHoliday={() => setHolidayOpen(true)}
        onCreate={openCreate}
      />

      {todayMissed.length > 0 && (
        <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-5 py-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            你有 <strong>{todayMissed.length}</strong> 项任务已错过未完成，请尽快处理。
          </span>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-hidden bg-card">
            {view === 'month' && (
              <MonthView
                anchor={anchor}
                today={today}
                selected={selected}
                instanceMap={instanceMap}
                holidays={activeHolidays}
                onSelect={handleSelect}
              />
            )}
            {view === 'week' && (
              <WeekView
                anchor={anchor}
                today={today}
                selected={selected}
                instanceMap={instanceMap}
                holidays={activeHolidays}
                onSelect={handleSelect}
              />
            )}
            {view === 'day' && (
              <DayView
                selected={selected}
                today={today}
                instances={selectedInstances}
                holidays={activeHolidays}
                onComplete={completeInstance}
                onUncomplete={uncompleteInstance}
                onOpenTask={openEdit}
              />
            )}
          </div>
          <Legend />
        </main>

        {view !== 'day' && (
          <DaySidebar
            selected={selected}
            today={today}
            instances={selectedInstances}
            holidays={activeHolidays}
            onComplete={completeInstance}
            onUncomplete={uncompleteInstance}
            onOpenTask={openEdit}
            onCreate={openCreate}
          />
        )}
      </div>

      <TaskForm
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultDate={selected}
        editingTask={editingTask}
        onSubmit={addTask}
        onUpdate={updateTask}
        onDelete={deleteTask}
      />

      <HolidayDialog
        open={holidayOpen}
        onOpenChange={setHolidayOpen}
        enabled={state.holidayModeEnabled}
        holidays={state.holidays}
        onToggleEnabled={setHolidayModeEnabled}
        onAdd={addHoliday}
        onDelete={deleteHoliday}
      />
    </div>
  )
}
