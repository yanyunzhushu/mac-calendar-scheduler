const LEGEND = [
  { color: 'var(--status-single)', label: '日常任务' },
  { color: 'var(--status-recurring)', label: '周期任务' },
  { color: 'var(--status-ebbinghaus)', label: '艾宾浩斯复习' },
  { color: 'var(--status-progress)', label: '持续进度' },
  { color: 'var(--status-completed)', label: '已完成' },
  { color: 'var(--status-missed)', label: '已错过' },
  { color: 'var(--status-skipped)', label: '未做' },
]

export function Legend({
  focusedTaskName,
  nextStep,
}: {
  focusedTaskName?: string | null
  nextStep?: string | null
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border bg-card/40 px-5 py-2.5 text-xs text-muted-foreground">
      {LEGEND.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/30" />
        未来（浅色）
      </div>
      {focusedTaskName && (
        <>
          <span className="text-muted-foreground/40">|</span>
          <span className="max-w-40 truncate font-medium text-foreground">{focusedTaskName}</span>
          {nextStep && (
            <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-emerald-700">
              下一步：{nextStep}
            </span>
          )}
        </>
      )}
    </div>
  )
}
