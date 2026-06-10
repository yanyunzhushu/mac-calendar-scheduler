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
  ProgressTask,
  RecurringTask,
  Task,
  TaskInstance,
} from './types'

/** 判断某日期是否落在任意假期区间内（仅当假期模式开启时生效，由调用方保证传入的 holidays 已过滤） */
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
    if (compareKey(cur, rangeEnd) > 0) break

    if (compareKey(cur, rangeStart) >= 0) {
      const completed = !!task.completions[cur]
      out.push({
        taskId: task.id,
        taskName: task.name,
        taskType: 'recurring',
        date: cur,
        status: resolveStatus(cur, today, completed),
        actionable: !completed && compareKey(cur, today) <= 0,
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

  for (let round = 0; round < intervals.length; round++) {
    if (task.end.type === 'count' && task.end.count != null && round >= task.end.count) {
      break
    }
    const date = addDays(task.startDate, intervals[round])
    if (task.end.type === 'date' && task.end.endDate && compareKey(date, task.end.endDate) > 0) {
      break
    }
    if (compareKey(date, rangeStart) < 0 || compareKey(date, rangeEnd) > 0) continue

    const completed = !!task.completions[date]
    out.push({
      taskId: task.id,
      taskName: task.name,
      taskType: 'ebbinghaus',
      date,
      status: resolveStatus(date, today, completed),
      actionable: !completed && compareKey(date, today) <= 0,
      meta: `第 ${round + 1} 次复习 · 第 ${intervals[round]} 天`,
    })
  }
  return out
}

// ---------- 持续进度任务 ----------

interface ProgressCycle {
  deadline: DateKey
  completedDate: DateKey | null
  onTime: boolean
}

/**
 * 模拟持续进度任务的推进过程，计算各周期的截止日与完成情况。
 * 规则：
 *  - 初始截止日 = startDate + N
 *  - 每次完成后，下一个截止日 = 完成日期 + N
 *  - 若截止日落在假期内，则顺延到假期结束后第一天
 *  - 待完成截止日：今天 <= 截止日 -> 橙；今天 > 截止日且不在假期 -> 红（错过）
 */
export function computeProgressCycles(
  task: ProgressTask,
  holidays: Holiday[],
  today: DateKey,
): { cycles: ProgressCycle[]; pending: ProgressCycle | null } {
  const N = Math.max(1, task.interval)
  const completedDates = Object.keys(task.completions).sort(compareKey)

  const cycles: ProgressCycle[] = []
  let deadline = adjustForHoliday(addDays(task.startDate, N), holidays)

  for (const c of completedDates) {
    const onTime = compareKey(c, deadline) <= 0
    cycles.push({ deadline, completedDate: c, onTime })
    deadline = adjustForHoliday(addDays(c, N), holidays)
  }

  // 暂停的任务不再产生待完成周期
  const pending: ProgressCycle | null = task.paused
    ? null
    : { deadline, completedDate: null, onTime: false }

  return { cycles, pending }
}

export function generateProgressInstances(
  task: ProgressTask,
  holidays: Holiday[],
  rangeStart: DateKey,
  rangeEnd: DateKey,
  today: DateKey,
): TaskInstance[] {
  const out: TaskInstance[] = []
  const { cycles, pending } = computeProgressCycles(task, holidays, today)

  const inRange = (d: DateKey) =>
    compareKey(d, rangeStart) >= 0 && compareKey(d, rangeEnd) <= 0

  // 已完成周期：在完成日上展示绿点；若是迟到完成，则在原截止日上展示红点
  for (const cy of cycles) {
    if (cy.completedDate && inRange(cy.completedDate)) {
      out.push({
        taskId: task.id,
        taskName: task.name,
        taskType: 'progress',
        date: cy.completedDate,
        status: 'completed',
        actionable: false,
        meta: cy.onTime ? '按时完成' : '补完成',
      })
    }
    if (!cy.onTime && cy.completedDate && inRange(cy.deadline) && cy.deadline !== cy.completedDate) {
      out.push({
        taskId: task.id,
        taskName: task.name,
        taskType: 'progress',
        date: cy.deadline,
        status: 'missed',
        actionable: false,
        meta: '错过的截止日',
      })
    }
  }

  // 待完成周期
  if (pending && inRange(pending.deadline)) {
    const inHoliday = !!findHoliday(pending.deadline, holidays)
    const todayInHoliday = !!findHoliday(today, holidays)
    let status: InstanceStatus
    if (inHoliday || todayInHoliday) {
      status = 'holiday'
    } else if (compareKey(today, pending.deadline) > 0) {
      status = 'missed'
    } else if (compareKey(pending.deadline, today) > 0) {
      status = 'future'
    } else {
      status = 'pending'
    }
    out.push({
      taskId: task.id,
      taskName: task.name,
      taskType: 'progress',
      date: pending.deadline,
      status,
      actionable: status !== 'holiday' && status !== 'future',
      meta: '当前截止日',
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
): TaskInstance[] {
  if (task.type === 'recurring') {
    return generateRecurringInstances(task, rangeStart, rangeEnd, today)
  }
  if (task.type === 'ebbinghaus') {
    return generateEbbinghausInstances(task, rangeStart, rangeEnd, today)
  }
  return generateProgressInstances(task, holidays, rangeStart, rangeEnd, today)
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

/** 统计今天错过的实例数量（用于顶部提醒） */
export function countTodayMissed(
  tasks: Task[],
  holidays: Holiday[],
  today: DateKey,
): TaskInstance[] {
  // 检查从最早任务到今天的范围
  if (tasks.length === 0) return []
  let earliest = today
  for (const t of tasks) {
    const s = (t as RecurringTask | EbbinghausTask | ProgressTask).startDate
    if (s && compareKey(s, earliest) < 0) earliest = s
  }
  const map = buildInstanceMap(tasks, holidays, earliest, today, today)
  const missed: TaskInstance[] = []
  for (const date of Object.keys(map)) {
    for (const inst of map[date]) {
      if (inst.status === 'missed') missed.push(inst)
    }
  }
  return missed
}

export { diffDays }
