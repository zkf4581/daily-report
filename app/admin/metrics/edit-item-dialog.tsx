'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { updateMetricItem } from './actions'

export type EditMetricItemInitial = {
  id: string
  name: string
  unit: string
  sort_order: number
}

// Controlled by MetricsTable so each row owns the open state. The inner form
// is mounted only while open, so its uncontrolled inputs reset to `initial`
// automatically on every reopen (no setState-in-effect needed).
export function EditMetricItemDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: EditMetricItemInitial
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑统计项</DialogTitle>
          <DialogDescription>
            修改名称 / 单位 / 排序；启用状态在列表中切换。
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <EditMetricItemForm
            initial={initial}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function EditMetricItemForm({
  initial,
  onDone,
}: {
  initial: EditMetricItemInitial
  onDone: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await updateMetricItem(initial.id, fd)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('已保存')
      onDone()
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`edit-metric-name-${initial.id}`}>名称</Label>
        <Input
          id={`edit-metric-name-${initial.id}`}
          name="name"
          required
          maxLength={50}
          defaultValue={initial.name}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`edit-metric-unit-${initial.id}`}>单位</Label>
        <Input
          id={`edit-metric-unit-${initial.id}`}
          name="unit"
          required
          maxLength={20}
          defaultValue={initial.unit}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`edit-metric-sort-${initial.id}`}>排序</Label>
        <Input
          id={`edit-metric-sort-${initial.id}`}
          name="sort_order"
          type="number"
          min={0}
          max={10000}
          step={1}
          required
          defaultValue={initial.sort_order}
        />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={pending}>
            取消
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? '保存中…' : '保存'}
        </Button>
      </DialogFooter>
    </form>
  )
}

