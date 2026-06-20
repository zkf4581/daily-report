'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { deleteMetricItem, setMetricItemActive } from './actions'
import { EditMetricItemDialog } from './edit-item-dialog'

export type MetricItemRow = {
  id: string
  name: string
  unit: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export function MetricsTable({ rows }: { rows: MetricItemRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>名称</TableHead>
          <TableHead className="w-24">单位</TableHead>
          <TableHead className="w-20 text-center">排序</TableHead>
          <TableHead className="w-24">状态</TableHead>
          <TableHead className="w-24 text-center">启用</TableHead>
          <TableHead className="w-40 text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <MetricRow key={r.id} row={r} />
        ))}
      </TableBody>
    </Table>
  )
}

function MetricRow({ row }: { row: MetricItemRow }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  function toggleActive(next: boolean) {
    if (pending) return
    startTransition(async () => {
      const res = await setMetricItemActive(row.id, next)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(next ? '已启用' : '已停用')
      router.refresh()
    })
  }

  function handleDelete() {
    if (pending) return
    startTransition(async () => {
      const res = await deleteMetricItem(row.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('已删除')
      setDeleteOpen(false)
      router.refresh()
    })
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{row.name}</TableCell>
      <TableCell className="text-sm">{row.unit}</TableCell>
      <TableCell className="text-center text-sm">{row.sort_order}</TableCell>
      <TableCell>
        {row.is_active ? (
          <Badge variant="default">启用</Badge>
        ) : (
          <Badge variant="destructive">已停用</Badge>
        )}
      </TableCell>
      <TableCell className="text-center">
        <Switch
          checked={row.is_active}
          disabled={pending}
          onCheckedChange={toggleActive}
          aria-label={row.is_active ? '停用统计项' : '启用统计项'}
        />
      </TableCell>
      <TableCell className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditOpen(true)}
          disabled={pending}
        >
          编辑
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDeleteOpen(true)}
          disabled={pending}
        >
          删除
        </Button>
        <EditMetricItemDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          initial={{
            id: row.id,
            name: row.name,
            unit: row.unit,
            sort_order: row.sort_order,
          }}
        />
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>删除「{row.name}」？</AlertDialogTitle>
              <AlertDialogDescription>
                删除后会一并级联删除所有外包此项的填写记录，且无法恢复。
                如只是暂时不再使用，建议改为「停用」。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
              <AlertDialogAction
                disabled={pending}
                onClick={(e) => {
                  e.preventDefault()
                  handleDelete()
                }}
              >
                {pending ? '删除中…' : '确认删除'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  )
}

