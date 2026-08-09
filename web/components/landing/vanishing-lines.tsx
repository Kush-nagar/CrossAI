'use client'

// The direction's signature gesture, in two halves of one move: the fresco's
// orthogonals draw toward the vanishing point on load, then straighten into
// parallel vertical rules as the hero scrolls away — the same rules the body
// grid is built on.

import { useRef } from 'react'
import { motion, useMotionValue, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion'

// x positions along the top/bottom edge; every line converges on (50, 46),
// which sits behind Plato's hand in the graded crop.
const ORIGINS = [0, 8, 18, 30, 44, 56, 70, 82, 92, 100]
const VANISH = { x: 50, y: 46 }

function Orthogonal({
  x,
  fromTop,
  index,
  progress,
}: {
  x: number
  fromTop: boolean
  index: number
  progress: MotionValue<number> | null
}) {
  // Straighten: the far endpoint travels from the vanishing point out to this
  // line's own x, so the converging fan resolves into vertical rules.
  const zero = useMotionValue(0)
  const source = progress ?? zero
  const x2 = useTransform(source, [0, 1], [VANISH.x, x])
  const y2 = useTransform(source, [0, 1], [VANISH.y, fromTop ? 100 : 0])
  return (
    <motion.line
      pathLength={1}
      x1={x}
      y1={fromTop ? 0 : 100}
      x2={x2}
      y2={y2}
      style={{ animationDelay: `${0.15 + index * 0.06}s` }}
    />
  )
}

export function VanishingLines() {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const opacity = useTransform(scrollYProgress, [0, 0.72, 1], [1, 1, 0])

  return (
    <div className="pv-a-lines" ref={ref} aria-hidden="true">
      <motion.svg viewBox="0 0 100 100" preserveAspectRatio="none" style={reduced ? undefined : { opacity }}>
        {ORIGINS.map((x, i) => (
          <Orthogonal key={x} x={x} fromTop={i % 2 === 0} index={i} progress={reduced ? null : scrollYProgress} />
        ))}
        <line pathLength={1} x1="0" y1={VANISH.y} x2="100" y2={VANISH.y} style={{ animationDelay: '0.9s' }} />
      </motion.svg>
    </div>
  )
}
