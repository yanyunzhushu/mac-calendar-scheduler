import type { AppState } from './types'

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024

type JsonObject = Record<string, unknown>

function invalid(path: string, reason: string): never {
  throw new Error(`${path}：${reason}`)
}

function object(value: unknown, path: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalid(path, '应为对象')
  }
  return value as JsonObject
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) invalid(path, '应为列表')
  return value
}

function string(value: unknown, path: string, allowEmpty = false): asserts value is string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) invalid(path, '应为非空文本')
}

function number(value: unknown, path: string, minimum = 0, integer = false): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || (integer && !Number.isSafeInteger(value))) {
    invalid(path, `应为不小于 ${minimum} 的有限${integer ? '整数' : '数值'}`)
  }
}

function optionalBoolean(value: unknown, path: string) {
  if (value !== undefined && typeof value !== 'boolean') invalid(path, '应为 true 或 false')
}

function date(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid(path, '日期格式应为 YYYY-MM-DD')
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(0)
  parsed.setUTCFullYear(year, month - 1, day)
  if (year < 1 || parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    invalid(path, '日期不存在')
  }
}

function records(value: unknown, path: string, integer = false) {
  for (const [key, entry] of Object.entries(object(value, path))) {
    date(key, `${path}的日期`)
    number(entry, `${path}[${key}]`, 0, integer)
  }
}

function endCondition(value: unknown, startDate: string, path: string) {
  const end = object(value, path)
  if (!['never', 'count', 'date'].includes(String(end.type))) invalid(path, '结束方式无效')
  if (end.count !== undefined) number(end.count, `${path}.count`, 1, true)
  if (end.endDate !== undefined) date(end.endDate, `${path}.endDate`)
  if (end.type === 'count') number(end.count, `${path}.count`, 1, true)
  if (end.type === 'date') {
    date(end.endDate, `${path}.endDate`)
    if (end.endDate < startDate) invalid(path, '结束日期不能早于起始日期')
  }
}

function task(value: unknown, path: string): JsonObject {
  const entry = object(value, path)
  string(entry.id, `${path}.id`)
  string(entry.name, `${path}.name`)
  number(entry.createdAt, `${path}.createdAt`)
  for (const key of ['description', 'groupId', 'themeId']) {
    if (entry[key] !== undefined) string(entry[key], `${path}.${key}`, key === 'description')
  }
  optionalBoolean(entry.paused, `${path}.paused`)
  if (entry.stoppedDate !== undefined) date(entry.stoppedDate, `${path}.stoppedDate`)
  records(entry.completions, `${path}.completions`, entry.countingMode === true)

  switch (entry.type) {
    case 'single':
      date(entry.date, `${path}.date`)
      optionalBoolean(entry.countingMode, `${path}.countingMode`)
      break
    case 'recurring':
      date(entry.startDate, `${path}.startDate`)
      if (!['daily', 'weekly', 'monthly', 'customDays'].includes(String(entry.freq))) invalid(path, '重复频率无效')
      number(entry.interval, `${path}.interval`, 1, true)
      optionalBoolean(entry.countingMode, `${path}.countingMode`)
      endCondition(entry.end, entry.startDate, `${path}.end`)
      break
    case 'ebbinghaus': {
      date(entry.startDate, `${path}.startDate`)
      const intervals = array(entry.intervals, `${path}.intervals`)
      if (!intervals.length) invalid(path, '复习间隔不能为空')
      intervals.forEach((interval, index) => number(interval, `${path}.intervals[${index}]`, 0, true))
      endCondition(entry.end, entry.startDate, `${path}.end`)
      break
    }
    case 'progress': {
      date(entry.startDate, `${path}.startDate`)
      const steps = array(entry.steps, `${path}.steps`)
      steps.forEach((value, index) => {
        const step = object(value, `${path}.steps[${index}]`)
        string(step.name, `${path}.steps[${index}].name`)
        number(step.interval, `${path}.steps[${index}].interval`, 1, true)
      })
      if (entry.defaultInterval !== undefined) number(entry.defaultInterval, `${path}.defaultInterval`, 1, true)
      if (entry.startStepIndex !== undefined) {
        number(entry.startStepIndex, `${path}.startStepIndex`, 0, true)
        if (entry.startStepIndex >= Math.max(steps.length, 1)) invalid(path, '起始步骤超出步骤列表范围')
      }
      if (entry.dailyCompletions !== undefined) records(entry.dailyCompletions, `${path}.dailyCompletions`, true)
      break
    }
    case 'longterm':
      date(entry.startDate, `${path}.startDate`)
      if (entry.acknowledgements !== undefined) records(entry.acknowledgements, `${path}.acknowledgements`)
      break
    default:
      invalid(path, '任务类型无效，支持日常、周期、复习、持续进度和长期任务')
  }
  return entry
}

function uniqueId(entry: JsonObject, seen: Set<string>, path: string) {
  string(entry.id, `${path}.id`)
  if (seen.has(entry.id)) invalid(path, `存在重复 ID「${entry.id}」`)
  seen.add(entry.id)
}

/** 完整校验后才返回；不通过过滤或类型转换丢弃原始数据。 */
export function validateBackupState(value: unknown): AppState {
  const state = object(value, '备份内容')
  const tasks = array(state.tasks, '任务列表')
  const holidays = array(state.holidays, '假期列表')
  const groups = state.groups === undefined ? [] : array(state.groups, '任务分组')
  const themes = state.themes === undefined ? [] : array(state.themes, '学习主题')
  const trash = state.trash === undefined ? [] : array(state.trash, '回收站')
  optionalBoolean(state.holidayModeEnabled, '假期模式')
  const taskIds = new Set<string>()
  tasks.forEach((value, index) => uniqueId(task(value, `任务 ${index + 1}`), taskIds, `任务 ${index + 1}`))
  const holidayIds = new Set<string>()
  holidays.forEach((value, index) => {
    const path = `假期 ${index + 1}`
    const holiday = object(value, path)
    uniqueId(holiday, holidayIds, path)
    date(holiday.start, `${path}.start`)
    date(holiday.end, `${path}.end`)
    if (holiday.end < holiday.start) invalid(path, '结束日期不能早于起始日期')
  })
  for (const [entries, name] of [[groups, '任务分组'], [themes, '学习主题']] as const) {
    const ids = new Set<string>()
    entries.forEach((value, index) => {
      const path = `${name} ${index + 1}`
      const entry = object(value, path)
      uniqueId(entry, ids, path)
      string(entry.name, `${path}.name`)
      number(entry.createdAt, `${path}.createdAt`)
    })
  }
  trash.forEach((value, index) => {
    const path = `回收站 ${index + 1}`
    const item = object(value, path)
    uniqueId(task(item.task, `${path}.task`), taskIds, path)
    number(item.deletedAt, `${path}.deletedAt`)
    number(item.expiresAt, `${path}.expiresAt`)
    if (item.expiresAt < item.deletedAt) invalid(path, '过期时间不能早于删除时间')
  })
  return { ...state, tasks, holidays, groups, themes, trash, holidayModeEnabled: state.holidayModeEnabled ?? false } as AppState
}

export function parseBackup(text: string): { state: AppState; exportedAt?: string } {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('文件不是有效的 JSON，请选择由日程安排导出的备份文件。')
  }
  const root = object(value, '备份文件')
  if ('version' in root || 'state' in root) {
    if (root.version !== 1) throw new Error('不支持此备份版本，请使用版本 1 的备份。')
    if (typeof root.exportedAt !== 'string' || !Number.isFinite(Date.parse(root.exportedAt))) {
      throw new Error('备份导出时间无效。')
    }
    return { state: validateBackupState(root.state), exportedAt: root.exportedAt }
  }
  return { state: validateBackupState(root) }
}

export function serializeBackup(state: AppState, now = new Date()): string {
  return JSON.stringify({ version: 1, exportedAt: now.toISOString(), state }, null, 2)
}
