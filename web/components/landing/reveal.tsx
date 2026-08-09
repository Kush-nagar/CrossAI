'use client'

// Scroll-reveal driver for the landing surface. Reveals are opt-in via JS:
// `.pv-rise` is fully visible in CSS until this marks the tree, so a failed
// hydration leaves a readable page rather than a blank one. Elements with
// their own staged animation (ledger bars, flow arrows) take `.pv-in` from
// the same observer.

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function Reveal() {
  const pathname = usePathname()

  useEffect(() => {
    const root = document.documentElement
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const targets = document.querySelectorAll<HTMLElement>('.pv-rise, .pv-ledger, .pv-b-flow')
    // Anything already on screen is marked settled BEFORE the offset class is
    // applied, so above-the-fold content never flashes out and back in.
    targets.forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) el.classList.add('pv-in')
    })
    root.classList.add('pv-js')

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('pv-in')
          io.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
    )
    targets.forEach((el) => io.observe(el))
    return () => {
      io.disconnect()
      root.classList.remove('pv-js')
    }
  }, [pathname])

  return null
}
