'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { createMetricItem } from './actions'

// Client wrapper for the "create metric item" dialog. The server action does
// the real validation + admin check; this layer is purely UX.
export function CreateMetricItemDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [pending, startTransition] = useTransition()

  function reset() {
    setName('')
    setUnit('')
    setSortOrder('0')
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return
    const fd = new FormData()
    fd.set('name', name.trim())
    fd.set('unit', unit.trim())
    fd.set('sort_order', sortOrder.trim())
    startTransition(async () => {
      const res = await createMetricItem(fd)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('已新增')
      reset()
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">新增统计项</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新增统计项</DialogTitle>
          <DialogDescription>
            外包会按此项每天填写数字（可为小数，最小 0）。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-metric-name">名称</Label>
            <Input
              id="new-metric-name"
              required
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：测试用例编写"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-metric-unit">单位</Label>
            <Input
              id="new-metric-unit"
              required
              maxLength={20}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="例如：个 / 条 / 小时"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-metric-sort">排序</Label>
            <Input
              id="new-metric-sort"
              type="number"
              min={0}
              max={10000}
              step={1}
              required
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="数字越小越靠前"
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
      </DialogContent>
    </Dialog>
  )
}

