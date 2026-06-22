'use client'

import { useSyncExternalStore } from 'react'

import { NumberTicker } from '@/components/magicui/number-ticker'
import { cn } from '@/lib/utils'

// Mirrors the SSR formatValue() in page.tsx: integers stay integers,
// decimals are trimmed to at most 4 places. We use this both for the
// static fallback (SSR / reduced-motion) and to compute decimalPlaces
// for NumberTicker so the animated readout matches the snapshot exactly.
function formatStatic(v: number): string {
  if (!Number.isFinite(v)) return '—'
  return Number.isInteger(v) ? String(v) : String(parseFloat(v.toFixed(4)))
}

function decimalsOf(v: number): number {
  if (!Number.isFinite(v) || Number.isInteger(v)) return 0
  const s = parseFloat(v.toFixed(4)).toString()
  const dot = s.indexOf('.')
  return dot < 0 ? 0 : s.length - dot - 1
}

// React-recommended pattern for subscribing to an external store
// (here: the prefers-reduced-motion media query). Avoids setState-in-effect
// while still keeping SSR markup stable (server snapshot = static fallback).
function subscribeReducedMotion(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

function getAnimateSnapshot() {
  if (typeof window === 'undefined') return false
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function getAnimateServerSnapshot() {
  return false
}

export function AnimatedTotal({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  const animate = useSyncExternalStore(
    subscribeReducedMotion,
    getAnimateSnapshot,
    getAnimateServerSnapshot,
  )

  if (!animate || !Number.isFinite(value)) {
    return (
      <span className={cn('inline-block tabular-nums', className)}>
        {formatStatic(value)}
      </span>
    )
  }

  return (
    <NumberTicker
      value={value}
      decimalPlaces={decimalsOf(value)}
      className={className}
    />
  )
}

