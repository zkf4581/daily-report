'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { LogoutButton } from '@/components/logout-button'
import { Button } from '@/components/ui/button'

// Shared top navigation for admin pages. Highlights the link matching the
// current pathname so admins can see where they are.
const LINKS = [
  { href: '/admin', label: '今日总览' },
  { href: '/admin/users', label: '账号管理' },
  { href: '/admin/metrics', label: '统计项配置' },
] as const

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {LINKS.map(({ href, label }) => {
        const isActive =
          href === '/admin' ? pathname === '/admin' : pathname?.startsWith(href)
        return (
          <Button
            key={href}
            asChild
            size="sm"
            variant={isActive ? 'secondary' : 'ghost'}
          >
            <Link href={href} aria-current={isActive ? 'page' : undefined}>
              {label}
            </Link>
          </Button>
        )
      })}
      <LogoutButton className="ml-1" />
    </nav>
  )
}

