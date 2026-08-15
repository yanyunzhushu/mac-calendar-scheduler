'use client'

import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import type { ProgressStep } from '@/lib/types'

interface ProgressStepEditorProps {
  /** 当前是否使用详细步骤模式（true）或简洁固定天数模式（false） */
  hasSteps: boolean
  /** 切换详细/简洁模式 */
  onHasStepsChange: (hasSteps: boolean) => void

  /** 详细步骤列表 */
  steps: ProgressStep[]
  /** 步骤列表变更回调 */
  onStepsChange: (steps: ProgressStep[]) => void

  /** 简洁模式下的默认推进天数 */
  defaultInterval: number
  /** 简洁模式推进天数变更回调 */
  onDefaultIntervalChange: (interval: number) => void

  /** 起始步骤索引（仅创建模式可改） */
  startStepIndex: number
  /** 起始步骤索引变更回调 */
  onStartStepIndexChange: (index: number) => void

  /** 是否为创建模式（创建模式才允许选择起始步骤） */
  isCreateMode: boolean

  /** 任务是否已有完成记录。有完成记录时锁定步骤结构，但允许修改名称与推进天数 */
  hasCompletions: boolean
}

/**
 * 持续进度任务的步骤编辑器。
 *
 * 设计要点：
 * - 步骤的"结构"（增删、顺序、起始步骤、有无步骤模式）在有完成记录后被锁定，
 *   因为历史 `dailyCompletions` 是按步骤索引顺序累积的，结构变化会导致映射错乱。
 * - 步骤的"推进天数 interval"在有完成记录后仍然允许修改，因为它只影响覆盖天数的计算，
 *   不影响索引映射。修改后会按当前 interval 实时重算进度条覆盖范围（追溯调整）。
 * - 步骤名称也始终允许修改，仅用于展示。
 */
export function ProgressStepEditor({
  hasSteps,
  onHasStepsChange,
  steps,
  onStepsChange,
  defaultInterval,
  onDefaultIntervalChange,
  startStepIndex,
  onStartStepIndexChange,
  isCreateMode,
  hasCompletions,
}: ProgressStepEditorProps) {
  const structureLocked = hasCompletions

  // 切换为详细步骤模式时，用当前简洁模式的推进天数作为第一个步骤的默认值
  function switchToAdvanced() {
    onHasStepsChange(true)
    if (steps.length === 0) {
      onStepsChange([{ name: '', interval: defaultInterval }])
    }
  }

  // 切换为简洁模式时清空步骤
  function switchToSimple() {
    onHasStepsChange(false)
  }

  if (!hasSteps) {
    return (
      <div className="flex flex-col gap-3">
        <SimpleIntervalEditor
          value={defaultInterval}
          onChange={onDefaultIntervalChange}
        />
        {!structureLocked && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 self-start text-xs"
            onClick={switchToAdvanced}
          >
            <Plus className="h-3 w-3" />
            增添详细任务
          </Button>
        )}
        {structureLocked && (
          <StepStructureLockNotice>
            该任务已有完成记录，无法切换为详细步骤模式，以免历史进度映射错乱。
          </StepStructureLockNotice>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 起始步骤选择：仅在创建模式且步骤数大于 1 时显示 */}
      {isCreateMode && steps.length > 1 && (
        <StartStepSelector
          steps={steps}
          value={startStepIndex}
          onChange={onStartStepIndexChange}
        />
      )}

      {/* 结构锁定提示 */}
      {structureLocked && (
        <StepStructureLockNotice>
          该任务已有完成记录，步骤结构已锁定（不可新增、删除或重排步骤），但仍可修改步骤名称与推进天数。
        </StepStructureLockNotice>
      )}

      {/* interval 修改影响说明：仅编辑模式且有完成记录时显示 */}
      {structureLocked && (
        <IntervalChangeImpactNotice>
          推进天数的修改会基于当前步骤实时重算进度条覆盖范围，已生成的历史覆盖区域也会随之变化。
        </IntervalChangeImpactNotice>
      )}

      {/* 步骤表格 */}
      <StepTable
        steps={steps}
        onChange={onStepsChange}
        structureLocked={structureLocked}
      />

      {!structureLocked && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          onClick={() => onStepsChange([...steps, { name: '', interval: 1 }])}
        >
          <Plus className="h-3 w-3" />
          添加步骤
        </Button>
      )}

      {/* 切换回简洁模式：仅结构未锁定时允许 */}
      {!structureLocked && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 self-start text-xs text-muted-foreground hover:text-foreground"
          onClick={switchToSimple}
        >
          切换为固定推进天数
        </Button>
      )}
    </div>
  )
}

/** 简洁模式：固定推进天数编辑器 */
function SimpleIntervalEditor({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="shrink-0 text-sm">每完成一次推进</Label>
      <StepIntervalInput value={value} onChange={onChange} className="h-8" />
      <span className="text-sm text-muted-foreground">天</span>
    </div>
  )
}

/** 起始步骤选择器 */
function StartStepSelector({
  steps,
  value,
  onChange,
}: {
  steps: ProgressStep[]
  value: number
  onChange: (index: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="shrink-0 text-xs">起始步骤</Label>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className="h-8 w-48">
          <span className="truncate">
            {steps[value]?.name || `步骤 ${value + 1}`}
          </span>
        </SelectTrigger>
        <SelectContent>
          {steps.map((s, i) => (
            <SelectItem key={i} value={String(i)}>
              {s.name || `步骤 ${i + 1}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground">将从所选步骤开始推进</span>
    </div>
  )
}

/** 步骤表格 */
function StepTable({
  steps,
  onChange,
  structureLocked,
}: {
  steps: ProgressStep[]
  onChange: (steps: ProgressStep[]) => void
  structureLocked: boolean
}) {
  function updateStep(index: number, patch: Partial<ProgressStep>) {
    const next = [...steps]
    next[index] = { ...next[index], ...patch }
    onChange(next)
  }

  function removeStep(index: number) {
    const next = steps.filter((_, i) => i !== index)
    onChange(next)
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/50">
            <th className="w-8 px-2 py-1.5" />
            <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
              步骤名称
            </th>
            <th className="w-24 px-2 py-1.5 text-right font-medium text-muted-foreground">
              推进天数
            </th>
            {!structureLocked && <th className="w-10 px-2 py-1.5" />}
          </tr>
        </thead>
        <tbody>
          {steps.map((step, i) => (
            <StepRow
              key={i}
              index={i}
              step={step}
              onChange={(patch) => updateStep(i, patch)}
              onRemove={() => removeStep(i)}
              showRemove={!structureLocked}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 单行步骤编辑器 */
function StepRow({
  index,
  step,
  onChange,
  onRemove,
  showRemove,
}: {
  index: number
  step: ProgressStep
  onChange: (patch: Partial<ProgressStep>) => void
  onRemove: () => void
  showRemove: boolean
}) {
  return (
    <tr className="border-t border-border">
      <td className="px-2 py-1 text-center tabular-nums text-muted-foreground">
        {index + 1}
      </td>
      <td className="px-1 py-1">
        <Input
          value={step.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={`步骤 ${index + 1}`}
          className="h-7 text-xs"
        />
      </td>
      <td className="px-1 py-1">
        <div className="flex items-center justify-end gap-1">
          <StepIntervalInput
            value={step.interval}
            onChange={(value) => onChange({ interval: value })}
            className="h-7 w-14 text-right"
          />
          <span className="text-muted-foreground">天</span>
        </div>
      </td>
      {showRemove && (
        <td className="px-1 py-1 text-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-red-500"
            onClick={onRemove}
          >
            <X className="h-3 w-3" />
          </Button>
        </td>
      )}
    </tr>
  )
}

/** 推进天数输入框：统一处理最小值兜底 */
function StepIntervalInput({
  value,
  onChange,
  className,
}: {
  value: number
  onChange: (value: number) => void
  className?: string
}) {
  return (
    <Input
      type="number"
      min={1}
      className={className}
      value={value}
      onChange={(e) => onChange(parsePositiveInt(e.target.value))}
    />
  )
}

/** 结构锁定提示 */
function StepStructureLockNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
      {children}
    </div>
  )
}

/** interval 变更影响说明 */
function IntervalChangeImpactNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
      {children}
    </div>
  )
}

/** 解析为正整数，非法输入兜底为 1 */
function parsePositiveInt(raw: string): number {
  const n = parseInt(raw, 10)
  return isNaN(n) || n < 1 ? 1 : n
}
