'use client'

import { Check, Eye, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Holiday, ProgressStep, ProgressTask, Task, TaskInstance } from '@/lib/types'
import { TASK_TYPE_LABEL } from '@/lib/types'
import { dotColor, STATUS_LABEL, statusTextClass } from '@/lib/status-visuals'
import { computeProgressBarEnd, findCompletionForSkipDay } from '@/lib/task-engine'

interface InstanceItemProps {
  inst: TaskInstance
  task?: Task | null
  holidays?: Holiday[]
  onComplete: () => void
  onUncomplete: () => void
  onUndoSkip?: (undoDate: string) => void
  onOpenTask?: () => void
  onFocusTask?: (taskId: string) => void
  onTogglePause?: (taskId: string) => void
  isFocused?: boolean
  focusedTaskId?: string | null
}

/** 持续进度任务的步骤展示 */
function ProgressStepsDisplay({ steps, currentStepIndex }: { steps: ProgressStep[]; currentStepIndex: number }) {
  return (
    <div className="mb-2 rounded-lg bg-amber-50/60 px-2 py-1.5">
      <div className="flex flex-col">
        {steps.map((step, i) => {
          const isCurrent = i === currentStepIndex
          return (
            <div
              key={i}
              className={cn(
                'flex items-center justify-between gap-2 px-2 py-1 text-xs',
                isCurrent && 'rounded border-2 border-amber-400 bg-amber-100 font-medium',
                !isCurrent && 'text-muted-foreground',
              )}
            >
              <span className="min-w-0 truncate">{step.name}</span>
              <span className="shrink-0 tabular-nums">{Math.max(1, step.interval)}天</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function InstanceItem({ inst, task, holidays = [], onComplete, onUncomplete, onUndoSkip, onOpenTask, onFocusTask, onTogglePause, isFocused, focusedTaskId }: InstanceItemProps) {
  const focusActive = focusedTaskId != null
  const hasDesc = !!task?.description?.trim()
  const hasSteps = task?.type === 'progress' && ((task as any).steps as ProgressStep[])?.length > 0
  const expanded = isFocused && task != null && (hasDesc || hasSteps)

  // 已完成计数（用于脉冲反馈和显示，适用于计数模式日常任务和持续进度任务）
  const completedCount =
    inst.status === 'completed' ? (inst.count ?? 0) : 0

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 rounded-xl border bg-card p-3 transition-colors',
        isFocused ? 'border-blue-500 ring-2 ring-blue-200' : 'border-border',
        inst.status === 'completed' && !isFocused && 'border-emerald-200 bg-emerald-50/60',
        inst.status === 'missed' && !isFocused && 'border-red-200 bg-red-50/60',
        inst.status === 'skipped' && !isFocused && 'border-amber-200 bg-amber-50/60',
      )}
    >
      {/* 主体内容：聚焦其它任务时淡出 */}
      <div
        className="flex min-w-0 flex-1 items-start gap-3"
        style={{ opacity: focusActive && !isFocused ? 0.4 : 1 }}
      >
      <button
        type="button"
        className={cn(
          'mt-1 h-3 w-3 shrink-0 rounded-full transition-shadow',
          focusActive && 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-primary/50',
        )}
        style={{ backgroundColor: dotColor(inst) }}
        onClick={() => onFocusTask?.(inst.taskId)}
        title={focusActive ? (isFocused ? '退出任务视图' : '切换到此任务') : undefined}
      />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpenTask}
          className={cn(
            'flex items-center gap-1.5 truncate text-left text-sm font-medium',
            'hover:underline',
          )}
        >
          <span className="truncate">{inst.taskName}</span>
          {task?.paused && (
            <span className="shrink-0 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-700">
              已停止
            </span>
          )}
        </button>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="text-muted-foreground">{TASK_TYPE_LABEL[inst.taskType]}</span>
          {inst.status === 'skipped' && inst.meta ? (
            // 跳过日：meta（未做/已覆盖）直接作为状态文案，避免与状态标签重复
            <span className={statusTextClass(inst.status)}>· {inst.meta}</span>
          ) : (
            <>
              <span className={statusTextClass(inst.status)}>· {STATUS_LABEL[inst.status]}</span>
              {inst.meta && <span className="text-muted-foreground">· {inst.meta}</span>}
            </>
          )}
          {inst.status === 'completed' && completedCount > 0 && (
            <span
              key={`count-${completedCount}`}
              className={cn(
                'font-medium text-emerald-600',
                completedCount > 1 && 'animate-count-pop',
              )}
            >
              · {completedCount} 次
            </span>
          )}
        </div>

        {/* 任务视图展开：步骤 + 描述 */}
        {expanded && (
          <div className="mt-3 border-t border-border pt-3">
            {task!.type === 'progress' && ((task as any).steps as ProgressStep[])?.length > 0 && (
              <ProgressStepsDisplay
                steps={(task as any).steps as ProgressStep[]}
                currentStepIndex={(() => {
                  const pt = task as ProgressTask
                  const dc = pt.dailyCompletions ?? {}
                  const startIdx = pt.startStepIndex ?? 0
                  const steps = (task as any).steps as ProgressStep[]
                  // 计算该实例日期之前的总完成次数
                  let completionsBefore = 0
                  for (const key of Object.keys(dc).sort()) {
                    if (key < inst.date) completionsBefore += dc[key] ?? 0
                    else break
                  }
                  // 已完成实例：高亮当天完成的步骤；待完成/错过/跳过：高亮下一步
                  const idx = inst.status === 'completed'
                    ? completionsBefore
                    : completionsBefore + (dc[inst.date] ?? 0)
                  return (startIdx + idx) % steps.length
                })()}
              />
            )}
            {task!.description && (
              <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {task!.description}
              </p>
            )}
            {task?.paused && (
              <p className="mt-2 text-xs font-medium text-amber-600">⏸ 该任务已停止推进，不再生成新实例</p>
            )}
          </div>
        )}
      </div>
      </div>

      {/* 右侧按钮列：标记按钮居中，视图按钮靠右下 */}
      <div className="flex shrink-0 flex-col items-center justify-center self-stretch">
        {/* 完成/撤销按钮：上下居中，随内容一起淡出 */}
        <div className="mt-0.5" style={{ opacity: focusActive && !isFocused ? 0.4 : 1 }}>
          {inst.count != null ? (
            <>
              {inst.count > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 min-w-[60px] gap-1 text-xs text-muted-foreground"
                  onClick={onUncomplete}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  撤销 ({inst.count})
                </Button>
              )}
              <Button size="sm" className="h-8 min-w-[60px] gap-1 text-xs" onClick={onComplete}>
                <Check className="h-3.5 w-3.5" />
                标记
              </Button>
            </>
          ) : inst.status === 'completed' ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 min-w-[60px] gap-1 text-xs text-muted-foreground"
              onClick={onUncomplete}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              撤销
            </Button>
          ) : inst.status === 'skipped' ? (
            (() => {
              // 无实际完成记录时（纯 startStepIndex 偏移覆盖），无需撤销
              const pt = task as ProgressTask | undefined
              const dc = pt?.dailyCompletions ?? {}
              const hasAny = Object.values(dc).some((v) => (v ?? 0) > 0)
              if (!hasAny) return null
              return (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 min-w-[60px] gap-1 text-xs text-amber-600 hover:text-amber-700"
              onClick={() => {
                if (onUndoSkip && task?.type === 'progress') {
                  const sorted = Object.keys(dc).filter((d) => (dc[d] ?? 0) > 0).sort()
                  const barEnd = computeProgressBarEnd(pt!, holidays)
                  const undoDate = findCompletionForSkipDay(inst.date, sorted, pt!.startDate, barEnd)
                  if (undoDate) onUndoSkip(undoDate)
                }
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              撤销
            </Button>
            )})()
          ) : inst.actionable ? (
            <Button size="sm" className="h-8 min-w-[60px] gap-1 text-xs" onClick={onComplete}>
              <Check className="h-3.5 w-3.5" />
              标记
            </Button>
          ) : null}
        </div>

        {/* 切换按钮：贴底部边框，靠右，始终全不透明度 */}
        {onFocusTask && (
          <Button
            variant={isFocused ? 'default' : 'outline'}
            size="icon"
            className={cn(
              'mt-auto -mb-2 h-6 w-6 self-end transition-all',
              isFocused
                ? 'bg-primary text-primary-foreground shadow-sm'
                : focusActive
                  ? 'border-blue-400 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700'
                  : 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/50',
            )}
            onClick={() => onFocusTask?.(inst.taskId)}
            title={isFocused ? '退出任务视图' : '在日历上查看'}
          >
            <Eye className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* 计数完成脉冲反馈：count > 1 时显示绿色背景闪烁 */}
      {completedCount > 1 && (
        <div
          key={`pulse-${completedCount}`}
          className="pointer-events-none absolute inset-0 rounded-xl animate-progress-pulse"
          aria-hidden="true"
        />
      )}
    </div>
  )
}
