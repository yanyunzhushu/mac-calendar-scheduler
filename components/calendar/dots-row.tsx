import type { TaskInstance } from '@/lib/types'
import { dotColor, isFaded } from '@/lib/status-visuals'

export function DotsRow({ instances, max = 4 }: { instances: TaskInstance[]; max?: number }) {
  if (instances.length === 0) return null
  const shown = instances.slice(0, max)
  const extra = instances.length - shown.length
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((inst, i) => (
        <span
          key={`${inst.taskId}-${i}`}
          className="inline-block h-2 w-2 rounded-full"
          style={{
            backgroundColor: dotColor(inst),
            opacity: isFaded(inst.status) ? 0.4 : 1,
          }}
          title={`${inst.taskName} · ${inst.status}`}
          aria-hidden="true"
        />
      ))}
      {extra > 0 && (
        <span className="text-[10px] font-medium leading-none text-muted-foreground">
          +{extra}
        </span>
      )}
    </div>
  )
}
