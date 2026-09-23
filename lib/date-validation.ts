import type { DateKey } from './date-utils'

/** 严格校验日期，拒绝 Date 自动归一化的 2 月 31 日等不存在的日期。 */
export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

/** 只传入当前任务实际使用的结束日期，避免隐藏字段阻止提交。 */
export function validateTaskDates(startDate: string, endDate?: string) {
  const errors: { startDate?: string; endDate?: string } = {}
  if (!startDate) errors.startDate = '请选择日期'
  else if (!isValidDateKey(startDate)) errors.startDate = '请输入有效日期（YYYY-MM-DD）'
  if (endDate !== undefined) {
    if (!endDate) errors.endDate = '请选择结束日期'
    else if (!isValidDateKey(endDate)) errors.endDate = '请输入有效的结束日期（YYYY-MM-DD）'
    else if (!errors.startDate && endDate < startDate) errors.endDate = '结束日期不能早于起始日期'
  }
  return errors
}

/** 日期跳转支持 YYYY.M、YYYY-MM、YYYYMM 及带日号的对应格式。 */
export function parseDateInput(input: string): DateKey | null {
  const value = input.trim()
  const separated = /^(\d{4})[.\-/](\d{1,2})(?:[.\-/](\d{1,2}))?$/.exec(value)
  const compact = /^(\d{4})(\d{2})(\d{2})?$/.exec(value)
  const match = separated ?? compact
  if (!match) return null
  const year = Number(match[1])
  if (year < 2000 || year > 2100) return null
  const key = `${match[1]}-${match[2].padStart(2, '0')}-${(match[3] ?? '1').padStart(2, '0')}`
  return isValidDateKey(key) ? key : null
}
