import {
  addDays,
  addMonths,
  compareKey,
  diffDays,
  isWithin,
  type DateKey,
} from './date-utils'
import type {
  EbbinghausTask,
  EndCondition,
  Holiday,
  InstanceStatus,
  LongTermTask,
  ProgressStep,
  ProgressTask,
  RecurringTask,
  SingleTask,
  Task,
  TaskInstance,
} from './types'

export interface InstanceOptions {
  /** 仅预览周期任务的未来安排；未来实例不可完成。默认保持只展示到今天。 */
  showFutureRecurring?: boolean
}

// ---------- 持续进度任务 ----------
export function findHoliday(key: DateKey, holidays: Holiday[]): Holiday | undefined {
  return holidays.find((h) => isWithin(key, h.start, h.end))
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
  showFutureRecurring = false,
): TaskInstance[] {
  const out: TaskInstance[] = []
  const stoppedDate = task.paused ? (task.stoppedDate ?? today) : undefined
  // 已有完成记录即使落在终止日之后也保留；终止仅截断尚未完成的日程。
  const lastCompletionDate = Object.keys(task.completions).filter((date) => !!task.completions[date]).sort().at(-1)
  let cur = task.startDate
  let idx = 0
  let guard = 0
  const maxGuard = 5000

  while (guard < maxGuard) {
    guard++
    if (recurringReachedEnd(task.end, idx, cur)) break
    if (compareKey(cur, rangeEnd) > 0) break
    if (stoppedDate && cur > stoppedDate && (!lastCompletionDate || cur > lastCompletionDate)) break

    // 默认只展示到今天，未来起始任务仅保留起始日灰色标记；开启预览后，
    // 在当前范围内继续展开未来安排，仍遵守次数、结束日期与固定终止日期。
    if (!showFutureRecurring && !stoppedDate && compareKey(cur, today) > 0) {
      if (out.length === 0 && idx === 0 && compareKey(cur, rangeStart) >= 0) {
        const counting = !!task.countingMode
        out.push({
          taskId: task.id,
          taskName: task.name,
          taskType: 'recurring',
          date: cur,
          status: 'future',
          actionable: false,
          count: counting ? (task.completions[cur] ?? 0) : undefined,
        })
      }
      break
    }

    if (compareKey(cur, rangeStart) >= 0 && (!stoppedDate || cur <= stoppedDate || !!task.completions[cur])) {
      const counting = !!task.countingMode
      const completed = !!task.completions[cur]
      const stopped = !!stoppedDate && cur >= stoppedDate
      out.push({
        taskId: task.id,
        taskName: task.name,
        taskType: 'recurring',
        date: cur,
        status: stopped && !completed ? 'stopped' : resolveStatus(cur, today, completed),
        actionable: !stopped && compareKey(cur, today) <= 0 && (counting || !completed),
        count: counting ? (task.completions[cur] ?? 0) : undefined,
      })
    }

    // 推进到下一个发生日
    idx++
    if (task.freq === 'daily') cur = addDays(cur, 1)
    else if (task.freq === 'weekly') cur = addDays(cur, 7)
    else if (task.freq === 'monthly') {
      // 始终基于原始起点，避免经过较短月份后永久漂移到 28/29 日。
      cur = addMonths(task.startDate, idx)
    } else {
      cur = addDays(cur, Math.max(1, task.interval))
    }
  }
  if (task.freq === 'monthly') {
    const displayedDates = new Set(out.map((inst) => inst.date))
    // 月底规则修复前可能在溢出日期完成过任务。保留原日期与次数供查看/撤销，
    // 不迁移完成记录，也不为这些已退出日程的历史日期提供新增完成操作。
    for (const [date, value] of Object.entries(task.completions)) {
      if (!value || !isWithin(date, rangeStart, rangeEnd) || displayedDates.has(date)) continue
      out.push({
        taskId: task.id,
        taskName: task.name,
        taskType: 'recurring',
        date,
        status: 'completed',
        actionable: false,
        count: task.countingMode ? value : undefined,
        meta: '历史完成记录',
      })
    }
    out.sort((a, b) => compareKey(a.date, b.date))
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
  const stoppedDate = task.paused ? (task.stoppedDate ?? today) : undefined
  const lastCompletionDate = Object.keys(task.completions).filter((date) => !!task.completions[date]).sort().at(-1)
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

    if (stoppedDate && date > stoppedDate && (!lastCompletionDate || date > lastCompletionDate)) break

    if (compareKey(date, rangeEnd) > 0) break
    if (compareKey(date, rangeStart) < 0 || (stoppedDate && date > stoppedDate && !task.completions[date])) {
      round++
      prevDate = date
      continue
    }

    const completed = !!task.completions[date]
    const stopped = !!stoppedDate && date >= stoppedDate
    out.push({
      taskId: task.id,
      taskName: task.name,
      taskType: 'ebbinghaus',
      date,
      status: stopped && !completed ? 'stopped' : resolveStatus(date, today, completed),
      actionable: !stopped && !completed,
      meta: `第 ${round + 1} 次复习`,
    })
    round++
    prevDate = date
  }
  return out
}

// ---------- 持续进度任务 ----------

/**
 * 从 start 开始推进 activeDays 个有效日（跳过假期）。
 * start 本身算作第 1 个有效日，返回最后一个有效日对应的日历日期。
 */
function addActiveDays(start: DateKey, activeDays: number, holidays: Holiday[]): DateKey {
  let cur = start
  let remaining = activeDays - 1
  let guard = 0
  const maxGuard = 10000
  while (remaining > 0 && guard < maxGuard) {
    guard++
    cur = addDays(cur, 1)
    if (!findHoliday(cur, holidays)) {
      remaining--
    }
  }
  return cur
}

/**
 * 计算进度条的结束日期（用于聚焦视图染色）。
 *
 * 重要语义：
 * 1. 本函数基于任务**当前**的 `steps[i].interval` 实时重算。
 *    因此，如果用户在已有完成记录后修改了某一步的推进天数，历史完成记录
 *    所覆盖的进度条范围也会随之变化（追溯调整）。
 * 2. 本函数也基于任务**当前**的 `startDate` 实时重算。
 *    修改 `startDate` 会整体平移进度条覆盖范围（已完成步骤累计天数不变，
 *    只是起点移动）。
 * 3. 假期模式开启时，holidays 为生效假期；假期不消耗推进天数，进度条会
 *    自动跨过假期向后延伸，保证覆盖的有效日数量不变。
 *
 * 这是当前引擎的设计选择，而非 bug；若未来需要"修改 interval/startDate
 * 不影响历史覆盖范围"，则需引入完成时的快照机制。
 *
 * 返回最后一次有完成记录对应的覆盖终点（或 startDate 前一天如果从未完成）。
 */
export function computeProgressBarEnd(task: ProgressTask, holidays: Holiday[] = []): DateKey {
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

  // barEnd 为累计 totalDays 个有效日所落到的日历日期（跳过假期）
  return addActiveDays(task.startDate, totalDays, holidays)
}

/** 获取有完成记录的日期列表（按 dailyCompletions） */
function getCompletionDates(task: ProgressTask): DateKey[] {
  const dc = task.dailyCompletions ?? {}
  return Object.keys(dc).filter((d) => (dc[d] ?? 0) > 0).sort()
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
        // 今天：始终可完成
        const inHoliday = !!findHoliday(today, holidays)
        if (inHoliday) {
          status = 'holiday'
          actionable = false
        } else {
          status = 'pending'
          actionable = true
        }
      } else {
        // 过去日：未完成 → 已错过（红色，可补做）
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

// ---------- 长期任务 ----------

/**
 * 长期任务：从 startDate 起每天生成一个「提醒」实例，永不结束。
 * - 无完成/错过概念，actionable 恒为 false
 * - 假期期间继续显示（不受假期模式影响）
 * - startDate 在未来时：仅显示起始日一个灰色未来标记（提醒尚未开始）
 */
export function generateLongTermInstances(
  task: LongTermTask,
  rangeStart: DateKey,
  rangeEnd: DateKey,
  today: DateKey,
): TaskInstance[] {
  const out: TaskInstance[] = []
  if (compareKey(task.startDate, today) > 0) {
    if (compareKey(task.startDate, rangeStart) >= 0 && compareKey(task.startDate, rangeEnd) <= 0) {
      out.push({
        taskId: task.id,
        taskName: task.name,
        taskType: 'longterm',
        date: task.startDate,
        status: 'future',
        actionable: false,
      })
    }
    return out
  }

  const start = compareKey(rangeStart, task.startDate) > 0 ? rangeStart : task.startDate
  const end = compareKey(today, rangeEnd) > 0 ? rangeEnd : today
  if (compareKey(start, end) > 0) return out

  const acks = task.acknowledgements ?? {}
  for (const date of getDateRange(start, end)) {
    out.push({
      taskId: task.id,
      taskName: task.name,
      taskType: 'longterm',
      date,
      status: 'reminder',
      actionable: false,
      acknowledged: !!acks[date],
    })
  }
  return out
}

// ---------- 汇总 ----------

export function generateInstancesForTask(
  task: Task,
  holidays: Holiday[],
  rangeStart: DateKey,
  rangeEnd: DateKey,
  today: DateKey,
  options: InstanceOptions = {},
): TaskInstance[] {
  let instances: TaskInstance[]
  if (task.type === 'single') {
    instances = generateSingleInstances(task, rangeStart, rangeEnd, today)
  } else if (task.type === 'recurring') {
    instances = generateRecurringInstances(task, rangeStart, rangeEnd, today, options.showFutureRecurring)
  } else if (task.type === 'ebbinghaus') {
    instances = generateEbbinghausInstances(task, rangeStart, rangeEnd, today)
  } else if (task.type === 'longterm') {
    instances = generateLongTermInstances(task, rangeStart, rangeEnd, today)
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
  options: InstanceOptions = {},
): Record<DateKey, TaskInstance[]> {
  const map: Record<DateKey, TaskInstance[]> = {}
  for (const task of tasks) {
    const instances = generateInstancesForTask(task, holidays, rangeStart, rangeEnd, today, options)
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
  // 与长期任务（只有提醒实例，永远不会有 missed 状态）
  const nonProgressTasks = tasks.filter((t) => t.type !== 'progress' && t.type !== 'longterm')
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
