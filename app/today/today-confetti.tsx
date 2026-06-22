'use client'

import { useEffect, useRef } from 'react'

import { Confetti, type ConfettiRef } from '@/components/magicui/confetti'

// Fires a single confetti burst when the page renders with `?saved=…`.
// Validation/error states (error=empty/metric/save) intentionally skip it —
// only true success triggers the celebration. Respects prefers-reduced-motion.
export function TodayConfetti({ saved }: { saved?: string }) {
  const ref = useRef<ConfettiRef>(null)

  useEffect(() => {
    if (!saved) return
    if (typeof window === 'undefined') return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    // Fire once on mount; the page reloads with a fresh canvas each save.
    ref.current?.fire({
      particleCount: 80,
      spread: 70,
      startVelocity: 35,
      ticks: 200,
      origin: { y: 0.6 },
    })
  }, [saved])

  return (
    <Confetti
      ref={ref}
      manualstart
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 h-full w-full motion-reduce:hidden"
    />
  )
}

