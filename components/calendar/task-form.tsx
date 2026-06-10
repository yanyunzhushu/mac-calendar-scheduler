'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { type DateKey } from '@/lib/date-utils'
import type {
  EbbinghausTask,
  EndCondition,
  EndConditionType,
  ProgressTask,
  RecurrenceFreq,
  RecurringTask,
  Task,
  TaskType,
} from '@/lib/types'
import { TASK_TYPE_LABEL } from '@/lib/types'
import { typeColor } from '@/lib/status-visuals'

interface TaskFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultDate: DateKey
  editingTask: Task | null
  onSubmit: (task: Omit<Task, 'id' | 'createdAt' | 'completions'>) => void
  onUpdate: (id: string, updates: Partial<Task>) => void
  onDelete: (id: string) => void
}

const TYPE_OPTIONS: TaskType[] = ['recurring', 'ebbinghaus', 'progress']

const FREQ_LABELS: Record<RecurrenceFreq, string> = {
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  customDays: '自定义每 N 天',
}

export function TaskForm({
  open,
  onOpenChange,
  defaultDate,
  editingTask,
  onSubmit,
  onUpdate,
  onDelete,
}: TaskFormProps) {
  const [type, setType] = useState<TaskType>('recurring')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState<DateKey>(defaultDate)

  // recurring
  const [freq, setFreq] = useState<RecurrenceFreq>('daily')
  const [intervalDays, setIntervalDays] = useState(3)

  // ebbinghaus
  const [intervalsText, setIntervalsText] = useState('0,1,2,4,7,15,30')

  // progress
  const [progressInterval, setProgressInterval] = useState(3)

  // end condition (recurring + ebbinghaus)
  const [endType, setEndType] = useState<EndConditionType>('never')
  const [endCount, setEndCount] = useState(10)
  const [endDate, setEndDate] = useState<DateKey>('')

  // 同步编辑状态
  useEffect(() => {
    if (!open) return
    if (editingTask) {
      setType(editingTask.type)
      setName(editingTask.name)
      setDescription(editingTask.description ?? '')
      if (editingTask.type === 'recurring') {
        setStartDate(editingTask.startDate)
        setFreq(editingTask.freq)
        setIntervalDays(editingTask.interval)
        applyEnd(editingTask.end)
      } else if (editingTask.type === 'ebbinghaus') {
        setStartDate(editingTask.startDate)
        setIntervalsText(editingTask.intervals.join(','))
        applyEnd(editingTask.end)
      } else {
        setStartDate(editingTask.startDate)
        setProgressInterval(editingTask.interval)
      }
    } else {
      setType('recurring')
      setName('')
      setDescription('')
      setStartDate(defaultDate)
      setFreq('daily')
      setIntervalDays(3)
      setIntervalsText('0,1,2,4,7,15,30')
      setProgressInterval(3)
      setEndType('never')
      setEndCount(10)
      setEndDate('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingTask, defaultDate])

  function applyEnd(end: EndCondition) {
    setEndType(end.type)
    if (end.type === 'count') setEndCount(end.count ?? 10)
    if (end.type === 'date') setEndDate(end.endDate ?? '')
  }

  function buildEnd(): EndCondition {
    if (endType === 'count') return { type: 'count', count: Math.max(1, endCount) }
    if (endType === 'date') return { type: 'date', endDate: endDate || undefined }
    return { type: 'never' }
  }

  function handleSubmit() {
    if (!name.trim()) return
    let payload: Omit<Task, 'id' | 'createdAt' | 'completions'>

    if (type === 'recurring') {
      payload = {
        type: 'recurring',
        name: name.trim(),
        description: description.trim() || undefined,
        startDate,
        freq,
        interval: Math.max(1, intervalDays),
        end: buildEnd(),
      } as Omit<RecurringTask, 'id' | 'createdAt' | 'completions'>
    } else if (type === 'ebbinghaus') {
      const intervals = intervalsText
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n >= 0)
      payload = {
        type: 'ebbinghaus',
        name: name.trim(),
        description: description.trim() || undefined,
        startDate,
        intervals: intervals.length ? intervals : [0],
        end: buildEnd(),
      } as Omit<EbbinghausTask, 'id' | 'createdAt' | 'completions'>
    } else {
      payload = {
        type: 'progress',
        name: name.trim(),
        description: description.trim() || undefined,
        startDate,
        interval: Math.max(1, progressInterval),
      } as Omit<ProgressTask, 'id' | 'createdAt' | 'completions'>
    }

    if (editingTask) {
      onUpdate(editingTask.id, payload as Partial<Task>)
    } else {
      onSubmit(payload)
    }
    onOpenChange(false)
  }

  const completionHistory =
    editingTask && editingTask.type === 'progress'
      ? Object.entries(editingTask.completions).sort((a, b) => (a[0] < b[0] ? 1 : -1))
      : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingTask ? '编辑任务' : '新建任务'}</DialogTitle>
          <DialogDescription>
            填写任务信息，不同任务类型会显示不同的设置项。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-4">
          {/* 任务类型 */}
          <div className="flex flex-col gap-2">
            <Label>任务类型</Label>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  disabled={!!editingTask}
                  onClick={() => setType(opt)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-xs transition-colors disabled:opacity-50 ${
                    type === opt
                      ? 'border-primary bg-accent'
                      : 'border-border hover:bg-accent/50'
                  }`}
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: typeColor(opt) }}
                  />
                  {TASK_TYPE_LABEL[opt]}
                </button>
              ))}
            </div>
            {editingTask && (
              <p className="text-xs text-muted-foreground">编辑时不可更改任务类型</p>
            )}
          </div>

          {/* 基础字段 */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-name">任务名称</Label>
            <Input
              id="task-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：背诵单词、跑步、读论文"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-desc">描述（可选）</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="补充说明"
              rows={2}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="task-start">
              {type === 'ebbinghaus' ? '开始日期（第 0 天学习日）' : '起始日期'}
            </Label>
            <Input
              id="task-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* 周期任务 */}
          {type === 'recurring' && (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex flex-col gap-2">
                <Label>重复规则</Label>
                <Select value={freq} onValueChange={(v) => setFreq(v as RecurrenceFreq)}>
                  <SelectTrigger>
                    <SelectValue>{FREQ_LABELS[freq]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">每天</SelectItem>
                    <SelectItem value="weekly">每周</SelectItem>
                    <SelectItem value="monthly">每月</SelectItem>
                    <SelectItem value="customDays">自定义每 N 天</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {freq === 'customDays' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm">每</span>
                  <Input
                    type="number"
                    min={1}
                    className="w-20"
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(parseInt(e.target.value, 10) || 1)}
                  />
                  <span className="text-sm">天重复一次</span>
                </div>
              )}
              <EndConditionEditor
                endType={endType}
                setEndType={setEndType}
                endCount={endCount}
                setEndCount={setEndCount}
                endDate={endDate}
                setEndDate={setEndDate}
                countLabel="重复次数"
              />
            </div>
          )}

          {/* 艾宾浩斯 */}
          {type === 'ebbinghaus' && (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="ebb-intervals">复习间隔序列（从第 0 天起，逗号分隔）</Label>
                <Input
                  id="ebb-intervals"
                  value={intervalsText}
                  onChange={(e) => setIntervalsText(e.target.value)}
                  placeholder="0,1,2,4,7,15,30"
                />
                <p className="text-xs text-muted-foreground">
                  系统将在开始日期后的这些天数自动生成复习日
                </p>
              </div>
              <EndConditionEditor
                endType={endType}
                setEndType={setEndType}
                endCount={endCount}
                setEndCount={setEndCount}
                endDate={endDate}
                setEndDate={setEndDate}
                countLabel="复习轮数"
              />
            </div>
          )}

          {/* 持续进度 */}
          {type === 'progress' && (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">每</span>
                <Input
                  type="number"
                  min={1}
                  className="w-20"
                  value={progressInterval}
                  onChange={(e) => setProgressInterval(parseInt(e.target.value, 10) || 1)}
                />
                <span className="text-sm">天推进一次</span>
              </div>
              <p className="text-xs text-muted-foreground">
                持续进度任务会滚动推进，没有固定结束条件，可随时暂停或删除。
              </p>
              {editingTask?.type === 'progress' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    当前状态：{editingTask.paused ? '已暂停' : '推进中'}
                  </span>
                </div>
              )}
              {completionHistory.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-medium">历史完成记录</p>
                  <div className="macos-scroll max-h-32 overflow-y-auto rounded-md bg-background p-2">
                    {completionHistory.map(([date, ts]) => (
                      <div
                        key={date}
                        className="flex items-center justify-between py-0.5 text-xs"
                      >
                        <span className="tabular-nums">{date}</span>
                        <span className="text-muted-foreground">
                          {new Date(ts).toLocaleString('zh-CN')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          {editingTask ? (
            <Button
              variant="ghost"
              className="gap-1.5 text-red-500 hover:bg-red-50 hover:text-red-600"
              onClick={() => {
                onDelete(editingTask.id)
                onOpenChange(false)
              }}
            >
              <Trash2 className="h-4 w-4" />
              删除
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={!name.trim()}>
              {editingTask ? '保存' : '创建'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EndConditionEditor({
  endType,
  setEndType,
  endCount,
  setEndCount,
  endDate,
  setEndDate,
  countLabel,
}: {
  endType: EndConditionType
  setEndType: (t: EndConditionType) => void
  endCount: number
  setEndCount: (n: number) => void
  endDate: DateKey
  setEndDate: (d: DateKey) => void
  countLabel: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>结束条件</Label>
      <RadioGroup value={endType} onValueChange={(v) => setEndType(v as EndConditionType)}>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="never" id="end-never" />
          <Label htmlFor="end-never" className="font-normal">
            永不
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="count" id="end-count" />
          <Label htmlFor="end-count" className="font-normal">
            {countLabel}
          </Label>
          {endType === 'count' && (
            <Input
              type="number"
              min={1}
              className="h-8 w-20"
              value={endCount}
              onChange={(e) => setEndCount(parseInt(e.target.value, 10) || 1)}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="date" id="end-date" />
          <Label htmlFor="end-date" className="font-normal">
            指定结束日期
          </Label>
          {endType === 'date' && (
            <Input
              type="date"
              className="h-8 w-40"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          )}
        </div>
      </RadioGroup>
    </div>
  )
}
