import {
  addDays,
  compareKey,
  diffDays,
  fromKey,
  isWithin,
  toKey,
  type DateKey,
} from './date-utils'
import type {
  EbbinghausTask,
  EndCondition,
  Holiday,
  InstanceStatus,
  ProgressStep,
  ProgressTask,
  RecurringTask,
  SingleTask,
  Task,
  TaskInstance,
} from './types'

// ---------- 持续进度任务 ----------
export function findHoliday(key: DateKey, holidays: Holiday[]): Holiday | undefined {
  return holidays.find((h) => isWithin(key, h.start, h.end))
}

/**
 * 将一个截止日按假期顺延：若落在假期内，则推到假期结束后的第一天。
 * 处理连续假期的情况。
 */
export function adjustForHoliday(key: DateKey, holidays: Holiday[]): DateKey {
  let result = key
  let guard = 0
  while (guard < 50) {
    const h = findHoliday(result, holidays)
    if (!h) break
    result = addDays(h.end, 1)
    guard++
  }
  return result
}

/** 计算实例状态：基于日期与今天的关系 */
function resolveStatus(date: DateKey, today: DateKey, completed: boolean): InstanceStatus {
  if (completed) return 'completed'
  const cmp = compareKey(date, today)
  if (cmp > 0) return 'future'
  if (cmp < 0) return 'missed'
  return 'pending' // 今天
}

// ---------- 周期任务 ----------

/** 判断结束条件是否在 occurrenceIndex（从 0 开始）/ date 处终止生成 */
function recurringReachedEnd(
  end: EndCondition,
  occurrenceIndex: number,
  date: DateKey,
): boolean {
  if (end.type === 'count' && end.count != null) {
    return occurrenceIndex >= end.count
  }
  if (end.type === 'date' && end.endDate) {
    return compareKey(date, end.endDate) > 0
  }
  return false
}

export function generateRecurringInstances(
  task: RecurringTask,
  rangeStart: DateKey,
  rangeEnd: DateKey,
  today: DateKey,
): TaskInstance[] {
  const out: TaskInstance[] = []
  let cur = task.startDate
  let idx = 0
  let guard = 0
  const maxGuard = 5000

  while (guard < maxGuard) {
    guard++
    if (recurringReachedEnd(task.end, idx, cur)) break
    // 终止后不再生成未来实例
    if (task.paused && compareKey(cur, today) > 0) break
    if (compareKey(cur, rangeEnd) > 0) break

    if (compareKey(cur, rangeStart) >= 0) {
      const counting = !!task.countingMode
      const completed = !!task.completions[cur]
      out.push({
        taskId: task.id,
        taskName: task.name,
        taskType: 'recurring',
        date: cur,
        status: resolveStatus(cur, today, completed),
        actionable: counting ? compareKey(cur, today) <= 0 : !completed,
        count: counting ? (task.completions[cur] ?? 0) : undefined,
      })
    }

    // 推进到下一个发生日
    idx++
    if (task.freq === 'daily') cur = addDays(cur, 1)
    else if (task.freq === 'weekly') cur = addDays(cur, 7)
    else if (task.freq === 'monthly') {
      const d = fromKey(task.startDate)
      const next = new Date(d.getFullYear(), d.getMonth() + idx, d.getDate())
      cur = toKey(next)
    } else {
      cur = addDays(cur, Math.max(1, task.interval))
    }
  }
  return out
}

// ---------- 艾宾浩斯复习任务 ----------

export function generateEbbinghausInstances(
  task: EbbinghausTask,
  rangeStart: DateKey,
  rangeEnd: DateKey,
  today: DateKey,
): TaskInstance[] {
  const out: TaskInstance[] = []
  const intervals = task.intervals.length ? task.intervals : [0]
  const lastGap = intervals[intervals.length - 1]

  let round = 0
  let guard = 0
  const maxGuard = 10000
  let prevDate: DateKey | null = null // 用变量跟踪上一个有效日期，而非依赖 out

  while (guard < maxGuard) {
    guard++
    if (task.end.type === 'count' && task.end.count != null && round >= task.end.count) {
      break
    }

    let date: DateKey
    if (round < intervals.length) {
      date = addDays(task.startDate, intervals[round])
    } else if (prevDate) {
      // 用最后一个间隔值作为固定的循环间隔
      date = addDays(prevDate, lastGap)
    } else {
      // out 为空且无 prevDate（所有固定间隔都在 rangeStart 前），计算后续日期
      const baseDays = intervals[intervals.length - 1] + (round - intervals.length + 1) * lastGap
      date = addDays(task.startDate, baseDays)
    }

    if (task.end.type === 'date' && task.end.endDate && compareKey(date, task.end.endDate) > 0) {
      break
    }

    // 终止后不再生成未来实例
    if (task.paused && compareKey(date, today) > 0) break

    if (compareKey(date, rangeEnd) > 0) break
    if (compareKey(date, rangeStart) < 0) {
      round++
      prevDate = date
      continue
    }

    const completed = !!task.completions[date]
    out.push({
      taskId: task.id,
      taskName: task.name,
      taskType: 'ebbinghaus',
      date,
      status: resolveStatus(date, today, completed),
      actionable: !completed,
      meta: `第 ${round + 1} 次复习`,
    })
    round++
    prevDate = date
  }
  return out
}

// ---------- 持续进度任务 ----------

/**
 * 计算进度条的结束日期（用于聚焦视图染色）。
 * 返回最后一次有完成记录的日期（或 startDate 如果从未完成）。
 */
export function computeProgressBarEnd(task: ProgressTask): DateKey {
  const dc = task.dailyCompletions ?? {}
  const steps = task.steps?.length ? task.steps : [{ name: '', interval: task.defaultInterval ?? 1 }]
  const startIdx = task.startStepIndex ?? 0

  // 统计总完成次数（支持单日多次链式完成）
  let totalCompletions = 0
  for (const key of Object.keys(dc)) {
    totalCompletions += dc[key] ?? 0
  }

  // 累加推进天数：仅计入已完成步骤的 interval
  // startStepIndex 仅决定从哪个步骤开始，不将前置步骤算作已完成进度
  let totalDays = 0
  for (let i = 0; i < totalCompletions; i++) {
    totalDays += steps[(startIdx + i) % steps.length].interval
  }

  if (totalDays === 0) {
    // 零完成且无起始偏移：返回 startDate 前一天，避免任何日期被染绿
    return addDays(task.startDate, -1)
  }

  // barEnd = startDate + 累计天数 - 1（startDate 自身为第 1 天）
  return addDays(task.startDate, totalDays - 1)
}

/** 获取有完成记录的日期列表（按 dailyCompletions） */
function getCompletionDates(task: ProgressTask): DateKey[] {
  const dc = task.dailyCompletions ?? {}
  return Object.keys(dc).filter((d) => (dc[d] ?? 0) > 0).sort()
}

/** 判断某日是否在两段完成记录之间的跳过区间内（不含完成日本身） */
function isInSkipRange(
  date: DateKey,
  completionDates: DateKey[],
  startDate: DateKey,
): boolean {
  let prev = startDate
  for (const c of completionDates) {
    // 跳过区间：prev+1 到 c-1（不含两端）
    if (compareKey(date, prev) > 0 && compareKey(date, c) < 0) return true
    prev = c
  }
  return false
}

/** 找到覆盖某跳过日的完成日期（用于撤销），找不到返回 null */
export function findCompletionForSkipDay(
  date: DateKey,
  sortedCompletions: DateKey[],
  startDate: DateKey,
  barEnd?: DateKey,
): DateKey | null {
  let prev = startDate
  for (const c of sortedCompletions) {
    // 跳过区间覆盖 prev+1 到 c-1
    if (compareKey(date, prev) > 0 && compareKey(date, c) <= 0) return c
    prev = c
  }
  // 日期在最后一次完成之后、barEnd 范围之内 → 返回最后一次完成
  if (sortedCompletions.length > 0 && barEnd && compareKey(date, prev) > 0 && compareKey(date, barEnd) <= 0) {
    return sortedCompletions[sortedCompletions.length - 1]
  }
  return null
}

export function generateProgressInstances(
  task: ProgressTask,
  holidays: Holiday[],
  rangeStart: DateKey,
  rangeEnd: DateKey,
  today: DateKey,
): TaskInstance[] {
  const out: TaskInstance[] = []
  const hasSteps = (task.steps?.length ?? 0) > 0
  const steps = task.steps?.length ? task.steps : [{ name: '', interval: task.defaultInterval ?? 1 }]
  const dc = task.dailyCompletions ?? {}
  const completionDates = getCompletionDates(task)
  const startIdx = task.startStepIndex ?? 0

  // 计算某日之前的总完成步数
  function totalCompletionsBefore(date: DateKey): number {
    let count = 0
    for (const key of completionDates) {
      if (key < date) count += dc[key] ?? 0
      else break
    }
    return count
  }

  // 仅显示 startDate 到 today 之间的实例（未来日"隐形"）
  // 若 startDate > today，仅显示 startDate 这一天（灰色未来）
  const displayEnd = compareKey(task.startDate, today) > 0 ? task.startDate : today
  const effectiveEnd = compareKey(displayEnd, rangeEnd) < 0 ? displayEnd : rangeEnd

  const start = compareKey(rangeStart, task.startDate) > 0 ? rangeStart : task.startDate
  if (compareKey(start, effectiveEnd) > 0) return out // 无可显示范围

  // 计算进度条覆盖终点（仅计入实际完成，startStepIndex 不产生预填进度）
  let barTotalCompletions = 0
  for (const key of completionDates) {
    barTotalCompletions += dc[key] ?? 0
  }
  let barEnd: DateKey
  let barTotalDays = 0
  for (let i = 0; i < barTotalCompletions; i++) {
    barTotalDays += steps[(startIdx + i) % steps.length].interval
  }
  if (barTotalDays === 0) {
    barEnd = addDays(task.startDate, -1)
  } else {
    barEnd = addDays(task.startDate, barTotalDays - 1)
  }

  const dates = getDateRange(start, effectiveEnd)

  for (const date of dates) {
    const completionsOnD = dc[date] ?? 0
    const completionsBeforeD = totalCompletionsBefore(date)

    if (completionsOnD > 0) {
      // ===== 情况 A：该日有完成记录 =====
      // 生成合并已完成实例
      // 无步骤任务不生成步骤链 meta（完成次数已由 count 展示）
      let meta: string | undefined
      if (hasSteps) {
        const baseStep = (startIdx + completionsBeforeD) % steps.length
        const completedStepNames: string[] = []
        for (let i = 0; i < completionsOnD; i++) {
          const si = (baseStep + i) % steps.length
          completedStepNames.push(steps[si].name || `步骤${si + 1}`)
        }
        // 同日多次完成同一步骤时折叠为 "名称 ×N"
        const allSame = completedStepNames.every((n) => n === completedStepNames[0])
        meta = allSame && completedStepNames.length > 1
          ? `${completedStepNames[0]} ×${completedStepNames.length} ✓`
          : `${completedStepNames.join(' → ')} ✓`
      }

      // 今天：把"下一阶段"并入已完成实例的 meta（链式完成功能由卡片上的"标记"按钮保留，不再额外生成待完成卡片）
      if (date === today && !task.paused && hasSteps && !findHoliday(today, holidays)) {
        const nextStepIdx = (startIdx + completionsBeforeD + completionsOnD) % steps.length
        const nextName = steps[nextStepIdx]?.name
        if (nextName) meta = `${meta} · 下一步: ${nextName}`
      }

      out.push({
        taskId: task.id,
        taskName: task.name,
        taskType: 'progress',
        date,
        status: 'completed',
        actionable: false,
        count: completionsOnD,
        meta,
      })
    } else {
      // ===== 情况 B：该日无完成记录 =====
      const stepIdx = (startIdx + completionsBeforeD) % steps.length
      const step = steps[stepIdx]

      let status: InstanceStatus
      let actionable: boolean
      let meta: string | undefined

      if (task.paused && date === today) {
        // 暂停中的今天：不可操作
        status = 'holiday'
        actionable = false
      } else if (compareKey(date, today) > 0) {
        // 未来日
        status = 'future'
        actionable = false
        meta = step?.name ? `下一步: ${step.name}` : undefined
      } else if (compareKey(date, today) === 0) {
        // 今天：无论进度条是否已覆盖（超前完成只是提前量），始终可完成
        const inHoliday = !!findHoliday(today, holidays)
        if (inHoliday) {
          status = 'holiday'
          actionable = false
        } else {
          status = 'pending'
          actionable = true
        }
      } else if (isInSkipRange(date, completionDates, task.startDate)) {
        // 过去日，在跳过区间内
        if (compareKey(date, barEnd) <= 0) {
          // 进度条已覆盖 → 已覆盖
          status = 'skipped'
          actionable = false
          meta = '已覆盖'
        } else {
          // 进度条未覆盖 → 未做
          status = 'skipped'
          actionable = false
          meta = step?.name ? `${step.name} · 未做` : '未做'
        }
      } else if (compareKey(date, barEnd) <= 0) {
        // 过去日，在进度条覆盖范围内（最后一次完成之后、barEnd 之前）→ 已覆盖
        status = 'skipped'
        actionable = false
        meta = '已覆盖'
      } else {
        // 过去日（超出覆盖范围）
        status = 'missed'
        actionable = true
      }

      // 任务名：仅今天待完成时显示步骤名
      const showStep = status === 'pending' && step?.name
      const taskName = showStep ? `${task.name} (${step!.name})` : task.name

      out.push({
        taskId: task.id,
        taskName,
        taskType: 'progress',
        date,
        status,
        actionable,
        meta,
      })
    }
  }

  return out
}

/** 展开 [rangeStart, rangeEnd] 区间内所有日期键 */
function getDateRange(rangeStart: DateKey, rangeEnd: DateKey): DateKey[] {
  const out: DateKey[] = []
  let cur = rangeStart
  let guard = 0
  while (guard < 1000 && compareKey(cur, rangeEnd) <= 0) {
    out.push(cur)
    cur = addDays(cur, 1)
    guard++
  }
  return out
}

// ---------- 日常任务 ----------

export function generateSingleInstances(
  task: SingleTask,
  rangeStart: DateKey,
  rangeEnd: DateKey,
  today: DateKey,
): TaskInstance[] {
  if (compareKey(task.date, rangeStart) < 0 || compareKey(task.date, rangeEnd) > 0) {
    return []
  }
  const completed = !!task.completions[task.date]
  return [
    {
      taskId: task.id,
      taskName: task.name,
      taskType: 'single',
      count: task.countingMode ? (task.completions[task.date] ?? 0) : undefined,
      actionable: task.countingMode ? compareKey(task.date, today) <= 0 : !completed && compareKey(task.date, today) <= 0,
      date: task.date,
      status: resolveStatus(task.date, today, completed),
    },
  ]
}

// ---------- 汇总 ----------

export function generateInstancesForTask(
  task: Task,
  holidays: Holiday[],
  rangeStart: DateKey,
  rangeEnd: DateKey,
  today: DateKey,
): TaskInstance[] {
  let instances: TaskInstance[]
  if (task.type === 'single') {
    instances = generateSingleInstances(task, rangeStart, rangeEnd, today)
  } else if (task.type === 'recurring') {
    instances = generateRecurringInstances(task, rangeStart, rangeEnd, today)
  } else if (task.type === 'ebbinghaus') {
    instances = generateEbbinghausInstances(task, rangeStart, rangeEnd, today)
  } else {
    instances = generateProgressInstances(task, holidays, rangeStart, rangeEnd, today)
  }
  // 假期期间隐藏周期任务与持续进度任务（仅显示层过滤，不改动数据与调度）
  if ((task.type === 'recurring' || task.type === 'progress') && holidays.length > 0) {
    instances = instances.filter((inst) => !findHoliday(inst.date, holidays))
  }
  return instances
}

/** 生成 rangeStart..rangeEnd 内按日期分组的实例 map */
export function buildInstanceMap(
  tasks: Task[],
  holidays: Holiday[],
  rangeStart: DateKey,
  rangeEnd: DateKey,
  today: DateKey,
): Record<DateKey, TaskInstance[]> {
  const map: Record<DateKey, TaskInstance[]> = {}
  for (const task of tasks) {
    const instances = generateInstancesForTask(task, holidays, rangeStart, rangeEnd, today)
    for (const inst of instances) {
      if (!map[inst.date]) map[inst.date] = []
      map[inst.date].push(inst)
    }
  }
  return map
}

/** 统计今天错过的实例数量（用于顶部提醒，排除持续进度任务） */
export function countTodayMissed(
  tasks: Task[],
  holidays: Holiday[],
  today: DateKey,
): TaskInstance[] {
  if (tasks.length === 0) return []
  // 排除持续进度任务（新模型每天都有实例，会泛滥错过计数）
  const nonProgressTasks = tasks.filter((t) => t.type !== 'progress')
  if (nonProgressTasks.length === 0) return []
  let earliest = today
  for (const t of nonProgressTasks) {
    const s = t.type === 'single' ? (t as SingleTask).date : (t as RecurringTask | EbbinghausTask).startDate
    if (s && compareKey(s, earliest) < 0) earliest = s
  }
  const map = buildInstanceMap(nonProgressTasks, holidays, earliest, today, today)
  const missed: TaskInstance[] = []
  for (const date of Object.keys(map)) {
    for (const inst of map[date]) {
      if (inst.status === 'missed') missed.push(inst)
    }
  }
  return missed
}

export { diffDays }
