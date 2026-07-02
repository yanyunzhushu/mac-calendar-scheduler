'use client'

import { Trash2, RotateCcw, Clock } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { TrashItem } from '@/lib/types'
import { TASK_TYPE_LABEL } from '@/lib/types'
import { typeColor } from '@/lib/status-visuals'

interface TrashDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trash: TrashItem[]
  onRestore: (taskId: string) => void
  onPermanentDelete: (taskId: string) => void
  onEmptyTrash: () => void
}

function formatTimeLeft(expiresAt: number): string {
  const ms = expiresAt - Date.now()
  if (ms <= 0) return '即将删除'
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  if (hours >= 24) return `${Math.floor(hours / 24)} 天后`
  if (hours > 0) return `${hours} 小时 ${minutes} 分后`
  return `${minutes} 分钟后`
}

export function TrashDialog({
  open,
  onOpenChange,
  trash,
  onRestore,
  onPermanentDelete,
  onEmptyTrash,
}: TrashDialogProps) {
  const sorted = [...trash].sort((a, b) => b.deletedAt - a.deletedAt)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>回收站</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          {trash.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              回收站为空
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-muted-foreground">
                  共 {trash.length} 项，过期自动删除
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs text-red-500 hover:text-red-600"
                  onClick={() => {
                    if (window.confirm('确定清空回收站？删除后无法恢复。')) {
                      onEmptyTrash()
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  清空回收站
                </Button>
              </div>

              {sorted.map((item) => (
                <TrashItemRow
                  key={item.task.id}
                  item={item}
                  onRestore={onRestore}
                  onPermanentDelete={onPermanentDelete}
                />
              ))}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TrashItemRow({
  item,
  onRestore,
  onPermanentDelete,
}: {
  item: TrashItem
  onRestore: (taskId: string) => void
  onPermanentDelete: (taskId: string) => void
}) {
  const expired = item.expiresAt <= Date.now()

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
      <span
        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: typeColor(item.task.type) }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{item.task.name}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span>{TASK_TYPE_LABEL[item.task.type]}</span>
          <span className="flex items-center gap-1">
            · <Clock className="h-3 w-3" />
            {expired ? (
              <span className="text-red-500">待清理</span>
            ) : (
              formatTimeLeft(item.expiresAt)
            )}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => onRestore(item.task.id)}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          恢复
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-red-500 hover:text-red-600"
          onClick={() => {
            if (window.confirm('确定永久删除？无法恢复。')) {
              onPermanentDelete(item.task.id)
            }
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
