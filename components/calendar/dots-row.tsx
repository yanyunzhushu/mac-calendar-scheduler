import type { TaskInstance } from '@/lib/types'
import { dotColor, isFaded } from '@/lib/status-visuals'

export function DotsRow({
  instances,
  max = 4,
  focusedTaskId,
}: {
  instances: TaskInstance[]
  max?: number
  focusedTaskId?: string | null
}) {
  if (instances.length === 0 || focusedTaskId != null) return null
  const shown = instances.slice(0, max)
  const extra = instances.length - shown.length
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((inst, i) => (
        <span
          key={`${inst.taskId}-${inst.date}-${inst.count ?? 0}-${i}`}
          className="inline-flex items-center gap-0.5"
          title={`${inst.taskName} · ${inst.status}${inst.count != null && inst.count > 1 ? ` (${inst.count}次)` : ''}`}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{
              backgroundColor: dotColor(inst),
              opacity: isFaded(inst.status) ? 0.4 : 1,
            }}
            aria-hidden="true"
          />
          {inst.status === 'completed' && inst.count != null && inst.count > 1 && (
            <span className="text-[9px] font-semibold leading-none text-emerald-600 tabular-nums">
              {inst.count}
            </span>
          )}
        </span>
      ))}
      {extra > 0 && (
        <span className="text-[10px] font-medium leading-none text-muted-foreground">
          +{extra}
        </span>
      )}
    </div>
  )
}
