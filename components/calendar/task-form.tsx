'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
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
import { addDays, compareKey, type DateKey } from '@/lib/date-utils'
import type {
  EbbinghausTask,
  EndCondition,
  EndConditionType,
  ProgressStep,
  ProgressTask,
  RecurrenceFreq,
  RecurringTask,
  SingleTask,
  Task,
  TaskType,
  Theme,
} from '@/lib/types'
import { TASK_TYPE_LABEL } from '@/lib/types'
import { typeColor } from '@/lib/status-visuals'
import { ProgressStepEditor } from './progress-step-editor'

interface TaskFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultDate: DateKey
  editingTask: Task | null
  onSubmit: (task: Omit<Task, 'id' | 'createdAt' | 'completions'>) => void
  onUpdate: (id: string, updates: Partial<Task>) => void
  onDelete: (id: string) => void
  onTogglePause?: (taskId: string) => void
  themes: Theme[]
  onCreateTheme: (name: string) => string
  onDeleteTheme: (id: string) => void
}

const TYPE_OPTIONS: TaskType[] = ['single', 'recurring', 'ebbinghaus', 'progress']

const FREQ_LABELS: Record<RecurrenceFreq, string> = {
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  customDays: '自定义每 N 天',
}

/** 淡出提示组件：2s 后自动消失 */
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      onClick={onDone}
    >
      <div
        className="animate-in fade-in zoom-in-95 rounded-xl border bg-background px-6 py-4 text-sm font-medium shadow-xl"
        style={{
          animation: 'toast-fade 1.3s ease-out forwards',
        }}
      >
        {message}
      </div>
      <style>{`
        @keyframes toast-fade {
          0% { opacity: 1; transform: scale(1); }
          38.5% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.95); }
        }
      `}</style>
    </div>
  )
}

export function TaskForm({
  open,
  onOpenChange,
  defaultDate,
  editingTask,
  onSubmit,
  onUpdate,
  onDelete,
  onTogglePause,
  themes,
  onCreateTheme,
  onDeleteTheme,
}: TaskFormProps) {
  const [type, setType] = useState<TaskType>('single')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [countingMode, setCountingMode] = useState(false)
  const [startDate, setStartDate] = useState<DateKey>(defaultDate)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // recurring
  const [freq, setFreq] = useState<RecurrenceFreq>('daily')
  const [intervalDays, setIntervalDays] = useState(3)

  // ebbinghaus
  const [intervalsText, setIntervalsText] = useState('0,1,2,4,7,15,30,60')
  const [themeId, setThemeId] = useState<string>('')

  // progress
  const [steps, setSteps] = useState<ProgressStep[]>([])
  const [hasSteps, setHasSteps] = useState(false)
  const [progressInterval, setProgressInterval] = useState(1)
  const [startStepIndex, setStartStepIndex] = useState(0)

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
      if (editingTask.type === 'single') {
        setStartDate(editingTask.date)
        setCountingMode((editingTask as any).countingMode ?? false)
      } else if (editingTask.type === 'recurring') {
        setStartDate(editingTask.startDate)
        setFreq(editingTask.freq)
        setIntervalDays(editingTask.interval)
        setCountingMode(editingTask.countingMode ?? false)
        applyEnd(editingTask.end)
      } else if (editingTask.type === 'ebbinghaus') {
        setStartDate(editingTask.startDate)
        setIntervalsText(editingTask.intervals.join(','))
        setThemeId(editingTask.themeId ?? '')
        applyEnd(editingTask.end)
      } else {
        setStartDate(editingTask.startDate)
        if (editingTask.steps?.length) {
          setHasSteps(true)
          setSteps(editingTask.steps)
          setStartStepIndex(editingTask.startStepIndex ?? 0)
        } else {
          setHasSteps(false)
          setProgressInterval(editingTask.defaultInterval ?? 1)
          setStartStepIndex(0)
        }
      }
    } else {
      setType('single')
      setCountingMode(false)
      setName('')
      setDescription('')
      setStartDate(defaultDate)
      setFreq('daily')
      setIntervalDays(3)
      setIntervalsText('0,1,2,4,7,15,30,60')
      setSteps([])
      setHasSteps(false)
      setProgressInterval(1)
      setStartStepIndex(0)
      setThemeId('')
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
    const errors: string[] = []
    if (!name.trim()) errors.push('请填写任务名称')
    if (type === 'ebbinghaus' && intervalError) errors.push(intervalError)
    if (endType === 'date' && !endDate) errors.push('请选择结束日期')
    if (errors.length) {
      setToastMsg(errors.join('；'))
      setTimeout(() => setToastMsg(null), 1300)
      return
    }
    let payload: Omit<Task, 'id' | 'createdAt' | 'completions'>

    if (type === 'single') {
      payload = {
        type: 'single',
        name: name.trim(),
        description: description.trim() || undefined,
        date: startDate,
        countingMode,
      } as Omit<SingleTask, 'id' | 'createdAt' | 'completions'>
    } else if (type === 'recurring') {
      payload = {
        type: 'recurring',
        name: name.trim(),
        description: description.trim() || undefined,
        startDate,
        freq,
        interval: Math.max(1, intervalDays),
        end: buildEnd(),
        countingMode,
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
        themeId: themeId || undefined,
      } as Omit<EbbinghausTask, 'id' | 'createdAt' | 'completions'>
    } else {
      payload = {
        type: 'progress',
        name: name.trim(),
        description: description.trim() || undefined,
        startDate,
        steps: hasSteps ? steps.filter((s) => s.name.trim()) : [],
        defaultInterval: hasSteps ? undefined : progressInterval,
        startStepIndex: hasSteps ? startStepIndex : undefined,
      } as Omit<ProgressTask, 'id' | 'createdAt' | 'completions'>
    }

    if (editingTask) {
      onUpdate(editingTask.id, payload as Partial<Task>)
    } else {
      onSubmit(payload)
    }
    onOpenChange(false)
  }

  const intervalError = validateIntervals(intervalsText)

  const hasCompletions =
    editingTask?.type === 'progress' &&
    Object.values((editingTask as ProgressTask).dailyCompletions ?? {}).some((v) => (v ?? 0) > 0)

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingTask ? '编辑任务' : '新建任务'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-4">
          {/* 任务类型 */}
          <div className="flex flex-col gap-2">
            <Label>任务类型</Label>
            <div className="grid grid-cols-4 gap-2">
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

          {/* 任务功能说明 */}
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 p-3">
            <Label className="text-xs">任务功能</Label>
            <p className="text-sm leading-relaxed">
              {type === 'single' && '在日常指定日期执行，完成后标记为已完成。'}
              {type === 'recurring' && '按固定周期自动重复（每天/每周/每月/自定义间隔），可设置结束条件。'}
              {type === 'ebbinghaus' && '按自定义间隔序列进行复习（如第 0、1、2、4、7 天…），适合背单词等需要周期性复习的内容。'}
              {type === 'progress' && '每日推进任务：起始日起每天生成一个实例，完成后跳至下一步，期间未完成的天数自动标记为未做。'}
            </p>
          </div>

          {/* 基础字段 */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-name" className="flex items-center gap-1">
              任务名称
              <span className="text-red-500">*</span>
            </Label>
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
              {type === 'single' ? '执行日期' : type === 'ebbinghaus' ? '首次学习' : '起始日期'}
            </Label>
            <Input
              id="task-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={hasCompletions}
            />
            {hasCompletions ? (
              <p className="text-xs text-amber-600">有完成记录后不可修改起始日期</p>
            ) : (
              <p className="text-xs text-muted-foreground">可直接输入或选择日期</p>
            )}
          </div>

          {/* 计数模式开关 */}
            {(editingTask?.type === 'single' || editingTask?.type === 'recurring') && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(editingTask as any).countingMode ?? false}
                  onChange={(e) => {
                    // 编辑模式下通过 onUpdate 修改
                    const enabled = e.target.checked
                    if (enabled) {
                      // 历史完成记录是时间戳，开启计数后归一为每次 1，避免显示成巨大次数
                      const normalized = Object.fromEntries(
                        Object.keys(editingTask.completions ?? {}).map((k) => [k, 1]),
                      )
                      onUpdate(editingTask.id, { countingMode: true, completions: normalized } as any)
                    } else {
                      onUpdate(editingTask.id, { countingMode: false } as any)
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                />
                <span className="text-sm">计数模式</span>
              </label>
              <span className="text-xs text-muted-foreground">开启后可在同一天多次标记完成并显示次数</span>
            </div>
            )}
            {(type === 'single' || type === 'recurring') && !editingTask && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={countingMode}
                  onChange={(e) => setCountingMode(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                />
                <span className="text-sm">计数模式</span>
              </label>
              <span className="text-xs text-muted-foreground">开启后可在同一天多次标记完成并显示次数</span>
            </div>
          )}

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

          {/* 复习任务 */}
          {type === 'ebbinghaus' && (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="ebb-intervals">复习间隔序列（从第 0 天起，逗号分隔）</Label>
                <Input
                  id="ebb-intervals"
                  value={intervalsText}
                  onChange={(e) => setIntervalsText(e.target.value)}
                  placeholder="0,1,2,4,7,15,30,60"
                />
                <p className="text-xs text-muted-foreground">
                  最后一个数字将作为长期复习间隔
                </p>
              </div>
              {intervalError && (
                <p className="text-xs text-red-500">{intervalError}</p>
              )}
              <EndConditionEditor
                endType={endType}
                setEndType={setEndType}
                endCount={endCount}
                setEndCount={setEndCount}
                endDate={endDate}
                setEndDate={setEndDate}
                countLabel="复习轮数"
              />
              {/* 学习主题 */}
              <div className="flex flex-col gap-2">
                <Label>学习主题（可选）</Label>
                <div className="flex items-center gap-2">
                  <Select value={themeId} onValueChange={setThemeId}>
                    <SelectTrigger className="flex-1">
                      <span data-slot="select-value" className="truncate">
                        {themeId ? (themes.find(t => t.id === themeId)?.name ?? themeId) : '无'}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">无</SelectItem>
                      {themes.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0"
                    onClick={() => {
                      const name = window.prompt('请输入学习主题名称')
                      if (name?.trim()) {
                        const id = onCreateTheme(name.trim())
                        setThemeId(id)
                      }
                    }}
                  >
                    新建
                  </Button>
                  {/* 当 themeId 存在但未在 themes 中找到时，显示原值作为后备提示 */}
                  {themeId && !themes.find(t => t.id === themeId) && (
                    <span className="text-xs text-muted-foreground">
                      （原主题已删除）
                    </span>
                  )}
                </div>
              </div>
              {!intervalError && (
                <ReviewTable intervalsText={intervalsText} startDate={startDate} endType={endType} endCount={endCount} endDate={endDate} />
              )}
            </div>
          )}

          {/* 持续进度 */}
          {type === 'progress' && (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <ProgressStepEditor
                hasSteps={hasSteps}
                onHasStepsChange={setHasSteps}
                steps={steps}
                onStepsChange={setSteps}
                defaultInterval={progressInterval}
                onDefaultIntervalChange={setProgressInterval}
                startStepIndex={startStepIndex}
                onStartStepIndexChange={setStartStepIndex}
                isCreateMode={!editingTask}
                hasCompletions={hasCompletions}
              />

              <p className="text-xs text-muted-foreground">
                每天生成一个待完成实例，完成后跳到下一步骤，期间未完成的天数自动标记为"未做"（黄色）。
              </p>
              {editingTask?.type === 'progress' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    当前状态：{editingTask.paused ? '已暂停' : '推进中'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          {editingTask ? (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="gap-1.5 text-red-500 hover:bg-red-50 hover:text-red-600"
                onClick={() => {
                  if (window.confirm('确定删除该任务？删除后将被移入回收站，隔天 24 点自动清除。')) {
                    onDelete(editingTask.id)
                    onOpenChange(false)
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
                删除
              </Button>
              {editingTask.type === 'progress' && hasCompletions && onTogglePause && (
                <Button
                  variant="ghost"
                  className="gap-1.5 text-xs text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                  onClick={() => onTogglePause(editingTask.id)}
                >
                  {editingTask.paused ? '恢复推进' : '停止推进'}
                </Button>
              )}
              {(editingTask.type === 'recurring' || editingTask.type === 'ebbinghaus') && onTogglePause && (
                <Button
                  variant="ghost"
                  className="gap-1.5 text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  onClick={() => onTogglePause(editingTask.id)}
                >
                  {editingTask.paused ? '取消终止' : '终止'}
                </Button>
              )}
            </div>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit}>
              {editingTask ? '保存' : '创建'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
      {toastMsg && createPortal(
        <Toast message={toastMsg} onDone={() => setToastMsg(null)} />,
        document.body
      )}
    </>
  )
}

/** 校验间隔序列，返回错误信息（无错误时返回 null） */
function validateIntervals(intervalsText: string): string | null {
  const parts = intervalsText.split(',').map((s) => s.trim())
  const nums = parts.map((s) => parseInt(s, 10))
  if (parts.some((s) => s === '')) return '格式错误：逗号之间不能为空'
  if (nums.some((n) => isNaN(n))) return '格式错误：请使用逗号分隔的数字'
  if (nums.some((n) => n < 0)) return '间隔天数不能为负数'
  if (nums.length < 2) return '至少需要输入 2 个间隔数字'
  if (nums[0] !== 0) return '第一个数字必须为 0（即学习当天）'
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] <= nums[i - 1])
      return `第 ${i + 1} 个数字（${nums[i]}）必须大于第 ${i} 个（${nums[i - 1]}），间隔序列必须严格递增`
  }
  return null
}

/** 将间隔序列按最后一个数字为循环间隔扩展至 targetLength 轮，返回间隔值数组（距起始日天数） */
function expandIntervals(intervals: number[], targetLength: number): number[] {
  if (targetLength <= intervals.length) return intervals.slice(0, targetLength)
  const lastGap = intervals[intervals.length - 1]
  const result = [...intervals]
  while (result.length < targetLength) {
    result.push(result[result.length - 1] + lastGap)
  }
  return result
}

/** 计算艾宾浩斯复习任务在结束条件下的总次数 */
function computeEbbinghausCount(
  intervals: number[],
  endType: EndConditionType,
  endCount: number,
  endDate: DateKey,
  startDate: DateKey,
): number | 'infinite' {
  if (endType === 'never') return 'infinite'
  if (endType === 'count') return Math.max(1, endCount)
  if (endType === 'date' && endDate) {
    const lastGap = intervals[intervals.length - 1]
    let count = 0
    let prevDate: DateKey | null = null
    while (true) {
      let date: DateKey
      if (count < intervals.length) {
        date = addDays(startDate, intervals[count])
      } else if (prevDate) {
        date = addDays(prevDate, lastGap)
      } else {
        break
      }
      if (compareKey(date, endDate) > 0) break
      count++
      prevDate = date
      if (count > 10000) break // safety guard
    }
    return count
  }
  return intervals.length
}

/** 复习间隔预览表格 */
function ReviewTable({
  intervalsText,
  startDate,
  endType,
  endCount,
  endDate,
}: {
  intervalsText: string
  startDate: DateKey
  endType: EndConditionType
  endCount: number
  endDate: DateKey
}) {
  const intervals = intervalsText
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n >= 0)

  if (intervals.length < 2) return null

  const total = computeEbbinghausCount(intervals, endType, endCount, endDate, startDate)
  const displayTotal = total === 'infinite' ? 20 : Math.min(total as number, 20)
  const rows = expandIntervals(intervals, displayTotal)

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">
        预计共{' '}
        {total === 'infinite' ? (
          <span className="font-medium">无限</span>
        ) : (
          <span className="font-medium tabular-nums">{total}</span>
        )}
        {' '}次复习
        {total === 'infinite' && <span className="text-muted-foreground">（永不结束，表格仅展示前 20 次）</span>}
        {typeof total === 'number' && total > 20 && <span className="text-muted-foreground">（可滚动查看全部，表格仅展示前 20 次）</span>}
      </p>
      <div className="macos-scroll max-h-[340px] overflow-y-auto rounded-md border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-2 py-1.5 text-left font-medium sticky top-0 bg-muted/50">复习</th>
              <th className="px-2 py-1.5 text-left font-medium sticky top-0 bg-muted/50">日期</th>
              <th className="px-2 py-1.5 text-right font-medium sticky top-0 bg-muted/50">距首次（天）</th>
              <th className="px-2 py-1.5 text-right font-medium sticky top-0 bg-muted/50">距上次（天）</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((interval, i) => {
              const gap = i > 0 ? interval - rows[i - 1] : 0
              const date = addDays(startDate, interval)
              return (
                <tr key={i} className="border-t border-border">
                  <td className="px-2 py-1 text-left">
                    <span className="tabular-nums">{i + 1}</span>
                  </td>
                  <td className="px-2 py-1 text-left tabular-nums whitespace-nowrap">
                    {date}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {i === 0 ? '-' : `${interval} 天`}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {i === 0 ? '-' : `${gap} 天`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
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
