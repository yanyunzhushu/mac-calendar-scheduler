'use client'

import { Check, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TaskInstance } from '@/lib/types'
import { TASK_TYPE_LABEL } from '@/lib/types'
import { dotColor, STATUS_LABEL, statusTextClass } from '@/lib/status-visuals'

interface InstanceItemProps {
  inst: TaskInstance
  onComplete: () => void
  onUncomplete: () => void
  onOpenTask?: () => void
}

export function InstanceItem({ inst, onComplete, onUncomplete, onOpenTask }: InstanceItemProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition-colors',
        inst.status === 'completed' && 'border-emerald-200 bg-emerald-50/60',
        inst.status === 'missed' && 'border-red-200 bg-red-50/60',
      )}
    >
      <span
        className="mt-1 h-3 w-3 shrink-0 rounded-full"
        style={{ backgroundColor: dotColor(inst) }}
      />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpenTask}
          className="block truncate text-left text-sm font-medium hover:underline"
        >
          {inst.taskName}
        </button>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="text-muted-foreground">{TASK_TYPE_LABEL[inst.taskType]}</span>
          <span className={statusTextClass(inst.status)}>· {STATUS_LABEL[inst.status]}</span>
          {inst.meta && <span className="text-muted-foreground">· {inst.meta}</span>}
        </div>
      </div>
      {inst.status === 'completed' ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 gap-1 text-xs text-muted-foreground"
          onClick={onUncomplete}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          撤销
        </Button>
      ) : inst.actionable ? (
        <Button size="sm" className="h-7 shrink-0 gap-1 text-xs" onClick={onComplete}>
          <Check className="h-3.5 w-3.5" />
          标记完成
        </Button>
      ) : null}
    </div>
  )
}
