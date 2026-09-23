'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MAX_BACKUP_BYTES, parseBackup, serializeBackup } from '@/lib/state-backup'
import type { AppState } from '@/lib/types'

interface BackupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  state: AppState
  onRestore: (state: AppState) => boolean
}

function downloadBackup(state: AppState, prefix = '日程安排备份') {
  const now = new Date()
  const blob = new Blob([serializeBackup(state, now)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${prefix}-${now.toISOString().replace(/[:.]/g, '-')}.json`
  document.body.appendChild(link)
  try {
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

export function BackupDialog({ open, onOpenChange, state, onRestore }: BackupDialogProps) {
  const [preview, setPreview] = useState<ReturnType<typeof parseBackup> | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reading, setReading] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const requestId = useRef(0)

  useEffect(() => {
    if (!open) {
      requestId.current += 1
      setPreview(null)
      setFileName('')
      setError('')
      setMessage('')
      setReading(false)
    }
  }, [open])

  async function readFile(file: File | undefined) {
    const currentRequest = ++requestId.current
    setPreview(null)
    setError('')
    setMessage('')
    setFileName(file?.name ?? '')
    setReading(false)
    if (!file) return
    if (file.size > MAX_BACKUP_BYTES) {
      setError('文件超过 10 MB，请选择不超过 10 MB 的 JSON 备份。')
      return
    }
    setReading(true)
    try {
      const result = parseBackup(await file.text())
      if (currentRequest === requestId.current) setPreview(result)
    } catch (err) {
      if (currentRequest === requestId.current) setError(err instanceof Error ? err.message : '无法读取备份文件。')
    } finally {
      if (currentRequest === requestId.current) setReading(false)
    }
  }

  function restore() {
    if (!preview || restoring) return
    setRestoring(true)
    setError('')
    setMessage('')
    try {
      downloadBackup(state, '恢复前备份')
      if (!onRestore(preview.state)) {
        setError('恢复失败，当前数据未替换。浏览器可能没有足够存储空间，请保管已发起下载的恢复前备份。')
        return
      }
      setPreview(null)
      setFileName('')
      setMessage('备份已恢复。恢复前数据的备份已发起下载，请检查浏览器下载记录并妥善保管。')
    } catch (err) {
      setError(err instanceof Error ? `恢复失败：${err.message}` : '恢复失败，请重试。')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>备份与恢复</DialogTitle>
          <DialogDescription>将日程保存为本地 JSON 文件，或从已有备份恢复。</DialogDescription>
        </DialogHeader>
        <section className="space-y-3 rounded-lg border p-4" aria-labelledby="backup-export-title">
          <h3 id="backup-export-title" className="text-sm font-medium">导出当前数据</h3>
          <p className="text-sm text-muted-foreground">包含 {state.tasks.length} 个任务、{state.holidays.length} 段假期、{state.trash.length} 个回收站项目，以及分组、学习主题和假期设置。</p>
          <Button variant="outline" className="gap-2" onClick={() => {
            setError('')
            try {
              downloadBackup(state)
              setMessage('备份下载已发起，请检查浏览器下载记录并妥善保管文件。')
            } catch {
              setMessage('')
              setError('无法发起备份下载，请重试。')
            }
          }}><Download className="h-4 w-4" />导出备份</Button>
        </section>
        <section className="space-y-3 rounded-lg border p-4" aria-labelledby="backup-import-title">
          <h3 id="backup-import-title" className="text-sm font-medium">从备份恢复</h3>
          <label className="block space-y-2 text-sm">
            <span className="text-muted-foreground">选择 JSON 备份（最大 10 MB），检查内容后再确认恢复。</span>
            <input type="file" accept=".json,application/json" disabled={restoring} className="block w-full min-w-0 rounded-md border p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1" onChange={(event) => {
              void readFile(event.target.files?.[0])
              event.target.value = ''
            }} />
          </label>
          {reading && <p role="status" className="text-sm text-muted-foreground">正在读取并检查备份…</p>}
          {preview && <div className="space-y-3">
            <div className="space-y-1 rounded-md bg-muted p-3 text-sm">
              <p className="break-all font-medium">{fileName}</p>
              {preview.exportedAt && <p className="text-muted-foreground">导出时间：{new Date(preview.exportedAt).toLocaleString('zh-CN')}</p>}
              <p>{preview.state.tasks.length} 个任务 · {preview.state.holidays.length} 段假期 · {preview.state.trash.length} 个回收站项目</p>
              <p className="text-muted-foreground">{preview.state.groups.length} 个分组 · {preview.state.themes.length} 个学习主题</p>
            </div>
            <p className="text-sm text-destructive">恢复将替换所有当前数据（含回收站），不会合并任务。确认后先发起当前数据备份下载，再执行恢复。回收站仍按原过期时间自动清理。</p>
            <Button variant="destructive" className="gap-2" disabled={reading || restoring} onClick={restore}><Upload className="h-4 w-4" />{restoring ? '正在恢复…' : '确认替换并恢复'}</Button>
          </div>}
        </section>
        {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
        {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      </DialogContent>
    </Dialog>
  )
}
