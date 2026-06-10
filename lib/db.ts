import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { todayKey } from './date-utils'
import type { Holiday, Task } from './types'

// ---------- 数据库路径 ----------

const DB_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DB_DIR, 'calendar.db')

// ---------- 单例连接 ----------

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true })
    }
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    initTables(db)
  }
  return db
}

// ---------- 建表 ----------

function initTables(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      completions TEXT NOT NULL DEFAULT '{}',
      paused INTEGER NOT NULL DEFAULT 0,
      -- 通用（周期任务 / 艾宾浩斯 / 持续进度 都有）
      start_date TEXT,
      -- 周期任务专用
      freq TEXT,
      interval_val INTEGER,
      end_type TEXT,
      end_count INTEGER,
      end_date TEXT,
      -- 艾宾浩斯专用
      intervals TEXT,
      -- 持续进度专用
      progress_interval INTEGER
    );

    CREATE TABLE IF NOT EXISTS holidays (
      id TEXT PRIMARY KEY,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  // 首次启动时填充示例数据
  const count = database.prepare('SELECT COUNT(*) as c FROM tasks').get() as { c: number }
  if (count.c === 0) {
    seedData(database)
  }
}

// ---------- 工具函数 ----------

function createId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

// ---------- 序列化 / 反序列化 ----------

type Row = Record<string, unknown>

function rowToTask(row: Row): Task {
  const base = {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) || undefined,
    createdAt: row.created_at as number,
    completions: JSON.parse((row.completions as string) || '{}') as Record<string, number>,
    paused: row.paused === 1,
  }

  switch (row.type as string) {
    case 'recurring':
      return {
        ...base,
        type: 'recurring',
        startDate: row.start_date as string,
        freq: row.freq as 'daily' | 'weekly' | 'monthly' | 'customDays',
        interval: row.interval_val as number,
        end: {
          type: (row.end_type as 'never' | 'count' | 'date') || 'never',
          ...(row.end_type === 'count' ? { count: row.end_count as number } : {}),
          ...(row.end_type === 'date' ? { endDate: row.end_date as string } : {}),
        },
      } as Task
    case 'ebbinghaus':
      return {
        ...base,
        type: 'ebbinghaus',
        startDate: row.start_date as string,
        intervals: JSON.parse((row.intervals as string) || '[0]') as number[],
        end: {
          type: (row.end_type as 'never' | 'count' | 'date') || 'never',
          ...(row.end_type === 'count' ? { count: row.end_count as number } : {}),
          ...(row.end_type === 'date' ? { endDate: row.end_date as string } : {}),
        },
      } as Task
    case 'progress':
      return {
        ...base,
        type: 'progress',
        startDate: row.start_date as string,
        interval: row.progress_interval as number,
      } as Task
    default:
      throw new Error(`Unknown task type: ${row.type}`)
  }
}

function taskToRow(task: Task): Row {
  const row: Row = {
    id: task.id,
    type: task.type,
    name: task.name,
    description: task.description ?? '',
    created_at: task.createdAt,
    completions: JSON.stringify(task.completions),
    paused: task.paused ? 1 : 0,
  }

  if (task.type === 'recurring') {
    row.start_date = task.startDate
    row.freq = task.freq
    row.interval_val = task.interval
    row.end_type = task.end.type
    if (task.end.type === 'count') row.end_count = task.end.count
    if (task.end.type === 'date') row.end_date = task.end.endDate
  } else if (task.type === 'ebbinghaus') {
    row.start_date = task.startDate
    row.intervals = JSON.stringify(task.intervals)
    row.end_type = task.end.type
    if (task.end.type === 'count') row.end_count = task.end.count
    if (task.end.type === 'date') row.end_date = task.end.endDate
  } else if (task.type === 'progress') {
    row.start_date = task.startDate
    row.progress_interval = task.interval
  }

  return row
}

// ---------- 种子数据 ----------

function seedData(database: Database.Database) {
  const today = todayKey()
  const now = Date.now()

  const base = {
    created_at: now,
    completions: '{}',
    paused: 0,
    start_date: today,
    end_type: null,
    end_count: null,
    end_date: null,
    intervals: null,
    progress_interval: null,
    freq: null,
    interval_val: null,
  }

  const seeds: Array<{ insert: Row; description: string }> = [
    {
      description: '每日晨间锻炼',
      insert: {
        ...base,
        id: createId(),
        type: 'recurring',
        name: '每日晨间锻炼',
        description: '30 分钟有氧运动',
        freq: 'daily',
        interval_val: 1,
        end_type: 'never',
      },
    },
    {
      description: '背诵英语单词 Unit 5',
      insert: {
        ...base,
        id: createId(),
        type: 'ebbinghaus',
        name: '背诵英语单词 Unit 5',
        description: '艾宾浩斯遗忘曲线复习',
        intervals: '[0,1,2,4,7,15,30]',
        end_type: 'never',
      },
    },
    {
      description: '每 3 天读一篇论文',
      insert: {
        ...base,
        id: createId(),
        type: 'progress',
        name: '每 3 天读一篇论文',
        description: '持续推进的阅读计划',
        progress_interval: 3,
      },
    },
    {
      description: '阅读半小时',
      insert: {
        ...base,
        id: createId(),
        type: 'recurring',
        name: '阅读半小时',
        description: '每天读书半小时',
        freq: 'daily',
        interval_val: 1,
        end_type: 'never',
      },
    },
    {
      description: '每周总结',
      insert: {
        ...base,
        id: createId(),
        type: 'progress',
        name: '每周总结',
        description: '记录一周的工作和学习',
        progress_interval: 7,
      },
    },
  ]

  const stmt = database.prepare(`
    INSERT INTO tasks (id, type, name, description, created_at, completions, paused,
      start_date, freq, interval_val, end_type, end_count, end_date, intervals, progress_interval)
    VALUES (@id, @type, @name, @description, @created_at, @completions, @paused,
      @start_date, @freq, @interval_val, @end_type, @end_count, @end_date, @intervals, @progress_interval)
  `)

  database.transaction(() => {
    for (const seed of seeds) {
      stmt.run(seed.insert)
    }
  })()
}

// ========== CRUD：任务 ==========

export function getAllTasks(): Task[] {
  const rows = getDb().prepare('SELECT * FROM tasks ORDER BY created_at ASC').all() as Row[]
  return rows.map(rowToTask)
}

export function createTask(task: Task): void {
  const row = taskToRow(task)
  const columns = Object.keys(row).join(', ')
  const values = Object.keys(row)
    .map((k) => `@${k}`)
    .join(', ')
  getDb().prepare(`INSERT INTO tasks (${columns}) VALUES (${values})`).run(row)
}

export function updateTask(id: string, task: Task): void {
  const row = taskToRow(task)
  const sets = Object.keys(row)
    .filter((k) => k !== 'id')
    .map((k) => `${k} = @${k}`)
    .join(', ')
  getDb().prepare(`UPDATE tasks SET ${sets} WHERE id = @id`).run({ ...row, id })
}

export function deleteTask(id: string): void {
  getDb().prepare('DELETE FROM tasks WHERE id = ?').run(id)
}

// ========== CRUD：假期 ==========

export function getAllHolidays(): Holiday[] {
  const rows = getDb()
    .prepare('SELECT id, start_date, end_date FROM holidays ORDER BY start_date ASC')
    .all() as Row[]
  return rows.map((r) => ({
    id: r.id as string,
    start: r.start_date as string,
    end: r.end_date as string,
  }))
}

export function createHoliday(holiday: Holiday): void {
  getDb()
    .prepare('INSERT INTO holidays (id, start_date, end_date) VALUES (?, ?, ?)')
    .run(holiday.id, holiday.start, holiday.end)
}

export function deleteHoliday(id: string): void {
  getDb().prepare('DELETE FROM holidays WHERE id = ?').run(id)
}

// ========== CRUD：配置 ==========

export function getConfig(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM config WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

export function setConfig(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO config (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(key, value)
}
