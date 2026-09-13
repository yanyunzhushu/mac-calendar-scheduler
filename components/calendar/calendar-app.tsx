'use client'

import { useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  compareKey,
  fromKey,
  getMonthGrid,
  getWeekDays,
  todayKey,
  type DateKey,
} from '@/lib/date-utils'
import { useAppState } from '@/lib/use-app-state'
import { buildInstanceMap, computeProgressBarEnd } from '@/lib/task-engine'
import type { Holiday, ProgressTask, Task, TaskInstance } from '@/lib/types'
import { TASK_TYPE_LABEL } from '@/lib/types'
import { CalendarHeader, type ViewMode } from './calendar-header'
import { MonthView } from './month-view'
import { WeekView } from './week-view'
import { DayView } from './day-view'
import { DaySidebar } from './day-sidebar'
import { TaskForm } from './task-form'
import { HolidayDialog } from './holiday-dialog'
import { TrashDialog } from './trash-dialog'


export function CalendarApp() {
  const {
    state,
    loaded,
    addTask,
    updateTask,
    deleteTask,
    restoreTask,
    permanentlyDeleteTask,
    emptyTrash,
    completeInstance,
    uncompleteInstance,
    togglePause,
    toggleAcknowledge,
    setHolidayModeEnabled,
    addHoliday,
    deleteHoliday,
    createTheme,
    deleteTheme,
  } = useAppState()

  const today = todayKey()
  const [view, setView] = useState<ViewMode>('month')
  const [anchor, setAnchor] = useState<DateKey>(today)
  const [selected, setSelected] = useState<DateKey>(today)
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [holidayOpen, setHolidayOpen] = useState(false)
  const [trashOpen, setTrashOpen] = useState(false)
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null)

  // 仅在假期模式开启时，假期才生效
  const activeHolidays: Holiday[] = state.holidayModeEnabled ? state.holidays : []

  // 实例排序：长期任务（每日提醒）置顶，其余按类型分组
  function compareInstances(a: TaskInstance, b: TaskInstance): number {
    if (a.taskType === b.taskType) return 0
    if (a.taskType === 'longterm') return -1
    if (b.taskType === 'longterm') return 1
    return a.taskType.localeCompare(b.taskType)
  }

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

  const instanceMap = useMemo(() => {
    const map = buildInstanceMap(state.tasks, activeHolidays, rangeStart, rangeEnd, today)
    for (const key of Object.keys(map)) {
      map[key].sort(compareInstances)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tasks, activeHolidays, rangeStart, rangeEnd, today])

  // 选中日的实例（单独按选中日计算，确保日/周/月视图一致）
  const selectedInstances = useMemo(() => {
    const map = buildInstanceMap(state.tasks, activeHolidays, selected, selected, today)
    return (map[selected] ?? []).sort(compareInstances)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tasks, activeHolidays, selected, today])

  // 任务视图：聚焦单个任务
  const focusedTask = focusedTaskId ? state.tasks.find((t) => t.id === focusedTaskId) ?? null : null
  const focusedInstanceMap = useMemo(() => {
    if (!focusedTask) return {}
    return buildInstanceMap([focusedTask], activeHolidays, rangeStart, rangeEnd, today)
  }, [focusedTask, activeHolidays, rangeStart, rangeEnd, today])

  const focusedProgress = useMemo(() => {
    if (!focusedTask || focusedTask.type !== 'progress') return null
    const pt = focusedTask as ProgressTask
    let barEnd = computeProgressBarEnd(pt, activeHolidays)
    // 停止推进后，进度条截至今天，不展示未来覆盖区域
    if (pt.paused && compareKey(barEnd, today) > 0) {
      barEnd = today
    }
    return {
      startDate: pt.startDate,
      barEnd,
      paused: pt.paused,
    }
  }, [focusedTask, activeHolidays, today])

  function handleSelect(key: DateKey) {
    setSelected(key)
    if (view === 'day') {
      setAnchor(key)
    } else if (view === 'month') {
      const clickedDate = fromKey(key)
      const anchorDate = fromKey(anchor)
      if (
        clickedDate.getMonth() !== anchorDate.getMonth() ||
        clickedDate.getFullYear() !== anchorDate.getFullYear()
      ) {
        setAnchor(key)
      }
    }
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

  function handleJump(key: DateKey) {
    setAnchor(key)
    setSelected(key)
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

  function handleDelete(taskId: string) {
    // 删除任务时，如果该任务正在被聚焦，自动退出任务视图
    if (focusedTaskId) {
      if (focusedTaskId === taskId) {
        setFocusedTaskId(null)
      } else {
        const task = state.tasks.find((t) => t.id === taskId)
        const focused = state.tasks.find((t) => t.id === focusedTaskId)
        if (task?.groupId && focused?.groupId === task.groupId) {
          setFocusedTaskId(null)
        }
      }
    }
    deleteTask(taskId)
  }

  function focusTask(taskId: string) {
    if (focusedTaskId === taskId) {
      setFocusedTaskId(null)
    } else {
      setFocusedTaskId(taskId)
      setView('month')
    }
  }

  function clearFocus() {
    setFocusedTaskId(null)
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
        selected={selected}
        holidayEnabled={state.holidayModeEnabled}
        trashCount={state.trash.length}
        onViewChange={setView}
        onPrev={() => navigate(-1)}
        onNext={() => navigate(1)}
        onToday={goToday}
        onJump={handleJump}
        onOpenHoliday={() => setHolidayOpen(true)}
        onOpenTrash={() => setTrashOpen(true)}
        onCreate={openCreate}
      />

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
                focusedTaskId={focusedTaskId}
                focusedInstanceMap={focusedInstanceMap}
                focusedProgress={focusedProgress}
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
                focusedTaskId={focusedTaskId}
                focusedInstanceMap={focusedInstanceMap}
                focusedProgress={focusedProgress}
              />
            )}
            {view === 'day' && (
              <DayView
                selected={selected}
                today={today}
                instances={selectedInstances}
                tasks={state.tasks}
                holidays={activeHolidays}
                onComplete={completeInstance}
                onUncomplete={uncompleteInstance}
                onToggleAck={toggleAcknowledge}
                onOpenTask={openEdit}
                onFocusTask={focusTask}
                onTogglePause={togglePause}
                focusedTaskId={focusedTaskId}
              />
            )}
          </div>
        </main>

        {view !== 'day' && (
          <DaySidebar
            selected={selected}
            today={today}
            instances={selectedInstances}
            tasks={state.tasks}
            holidays={activeHolidays}
            onComplete={completeInstance}
            onUncomplete={uncompleteInstance}
            onToggleAck={toggleAcknowledge}
            onOpenTask={openEdit}
            onFocusTask={focusTask}
            onTogglePause={togglePause}
            focusedTaskId={focusedTaskId}
            onClearFocus={clearFocus}
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
        onDelete={handleDelete}
        onTogglePause={togglePause}
        themes={state.themes}
        onCreateTheme={createTheme}
        onDeleteTheme={deleteTheme}
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

      <TrashDialog
        open={trashOpen}
        onOpenChange={setTrashOpen}
        trash={state.trash}
        onRestore={restoreTask}
        onPermanentDelete={permanentlyDeleteTask}
        onEmptyTrash={emptyTrash}
      />
    </div>
  )
}
