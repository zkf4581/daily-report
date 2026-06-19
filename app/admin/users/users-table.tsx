'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

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

import { ResetPasswordDialog } from './reset-password-dialog'

export type ContractorRow = {
  id: string
  email: string
  full_name: string | null
  is_active: boolean
  created_at: string
}

// Renders one row per contractor with: status badge, active toggle (Switch
// posting to PATCH /api/admin/users/[id]), and a reset-password trigger
// (AlertDialog). Refreshes the parent server component after a mutation so
// the list reflects the new state.
export function UsersTable({ rows }: { rows: ContractorRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>邮箱 / 姓名</TableHead>
          <TableHead className="w-24">状态</TableHead>
          <TableHead className="w-40">创建时间</TableHead>
          <TableHead className="w-28 text-center">启用</TableHead>
          <TableHead className="w-28 text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <UserRow key={r.id} row={r} />
        ))}
      </TableBody>
    </Table>
  )
}

function UserRow({ row }: { row: ContractorRow }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [resetOpen, setResetOpen] = useState(false)

  function toggleActive(next: boolean) {
    if (pending) return
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: next ? 'activate' : 'deactivate',
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        toast.error(data?.error ?? '更新失败，请稍后重试')
        return
      }
      toast.success(next ? '已启用' : '已停用')
      router.refresh()
    })
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">{row.email}</span>
          {row.full_name ? (
            <span className="text-xs text-muted-foreground">
              {row.full_name}
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        {row.is_active ? (
          <Badge variant="default">启用</Badge>
        ) : (
          <Badge variant="destructive">已停用</Badge>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDate(row.created_at)}
      </TableCell>
      <TableCell className="text-center">
        <Switch
          checked={row.is_active}
          disabled={pending}
          onCheckedChange={toggleActive}
          aria-label={row.is_active ? '停用账号' : '启用账号'}
        />
      </TableCell>
      <TableCell className="text-right">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setResetOpen(true)}
          disabled={pending}
        >
          重置密码
        </Button>
        <ResetPasswordDialog
          open={resetOpen}
          onOpenChange={setResetOpen}
          userId={row.id}
          userLabel={row.full_name || row.email}
        />
      </TableCell>
    </TableRow>
  )
}

function formatDate(iso: string): string {
  // Compact local-tz date+time for the admin overview. Keeps the table
  // narrow; full ISO is still in the underlying data.
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

