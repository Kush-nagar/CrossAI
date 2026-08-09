'use client'

// A template (not a layout) re-mounts on every navigation inside /preview,
// which is exactly the hook the A/B/C crossfade needs. Client-side routing
// means no white flash between directions.
// ponytail: framer-motion is already a dependency; no new transition library.

import { motion, useReducedMotion } from 'framer-motion'

export default function PreviewTemplate({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 14, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  )
}
