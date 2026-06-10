// 日期工具：统一使用 "YYYY-MM-DD" 字符串作为日期键，避免时区问题。

export type DateKey = string // "YYYY-MM-DD"

export function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/** 将 Date 转为本地日期键 */
export function toKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 将日期键解析为本地 Date（当天 00:00） */
export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayKey(): DateKey {
  return toKey(new Date())
}

/** 在日期键基础上增减天数 */
export function addDays(key: DateKey, days: number): DateKey {
  const d = fromKey(key)
  d.setDate(d.getDate() + days)
  return toKey(d)
}

export function addMonths(key: DateKey, months: number): DateKey {
  const d = fromKey(key)
  d.setMonth(d.getMonth() + months)
  return toKey(d)
}

/** 两个日期键之间相差的天数 (b - a) */
export function diffDays(a: DateKey, b: DateKey): number {
  const da = fromKey(a).getTime()
  const db = fromKey(b).getTime()
  return Math.round((db - da) / (1000 * 60 * 60 * 24))
}

export function compareKey(a: DateKey, b: DateKey): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

export function isSameDay(a: DateKey, b: DateKey): boolean {
  return a === b
}

/** 判断 key 是否在 [start, end] 闭区间内 */
export function isWithin(key: DateKey, start: DateKey, end: DateKey): boolean {
  return compareKey(key, start) >= 0 && compareKey(key, end) <= 0
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const MONTHS = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
]

export function weekdayLabel(key: DateKey): string {
  return WEEKDAYS[fromKey(key).getDay()]
}

export function monthLabel(monthIndex: number): string {
  return MONTHS[monthIndex]
}

export function formatLong(key: DateKey): string {
  const d = fromKey(key)
  return `${d.getFullYear()} 年 ${MONTHS[d.getMonth()]} ${d.getDate()} 日 ${WEEKDAYS[d.getDay()]}`
}

export function formatMonthTitle(key: DateKey): string {
  const d = fromKey(key)
  return `${d.getFullYear()} 年 ${MONTHS[d.getMonth()]}`
}

export function formatShort(key: DateKey): string {
  const d = fromKey(key)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/**
 * 生成月视图的 6x7 网格日期键（含上下月补齐），以周日为一周起点。
 */
export function getMonthGrid(anchor: DateKey): DateKey[] {
  const d = fromKey(anchor)
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const startOffset = first.getDay() // 0 = 周日
  const gridStart = new Date(first)
  gridStart.setDate(first.getDate() - startOffset)
  const keys: DateKey[] = []
  for (let i = 0; i < 42; i++) {
    const cur = new Date(gridStart)
    cur.setDate(gridStart.getDate() + i)
    keys.push(toKey(cur))
  }
  return keys
}

/** 获取某日期所在周（周日起）的 7 天 */
export function getWeekDays(anchor: DateKey): DateKey[] {
  const d = fromKey(anchor)
  const start = new Date(d)
  start.setDate(d.getDate() - d.getDay())
  const keys: DateKey[] = []
  for (let i = 0; i < 7; i++) {
    const cur = new Date(start)
    cur.setDate(start.getDate() + i)
    keys.push(toKey(cur))
  }
  return keys
}

export const WEEKDAY_HEADERS = ['日', '一', '二', '三', '四', '五', '六']
