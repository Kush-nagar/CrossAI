'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AppRail } from './app-rail'
import { TopBar } from './top-bar'
import { MobileNav } from './mobile-nav'
import { CommandBarProvider } from './command-bar'
import { ThemeToggle } from './theme-toggle'
import { navItems } from './nav-config'
import { OnboardingProvider } from '@/components/onboarding/onboarding-overlay'
import { applyAccessibilityClasses, loadLocalPrefs } from '@/lib/local-prefs'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [more, setMore] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const prefs = loadLocalPrefs()
    applyAccessibilityClasses(prefs)
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(prefs.reducedMotion || media.matches)
    const onChange = () => setReducedMotion(loadLocalPrefs().reducedMotion || media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return (
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'never'}>
    <CommandBarProvider>
    <OnboardingProvider>
      <div className="min-h-screen">
        <AppRail />
        <div className="mx-auto min-h-screen max-w-[1600px] px-4 pb-28 md:pb-10 md:pl-28 md:pr-8">
          <TopBar openMore={() => setMore(true)} />
          <main>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
        <MobileNav openMore={() => setMore(true)} />
        <AnimatePresence>
        {more && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm"
            onClick={() => setMore(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="more-title"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="surface absolute inset-x-3 bottom-3 rounded-xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            >
              <div className="flex items-center justify-between">
                <h2 id="more-title" className="font-display text-xl font-semibold">
                  Navigate
                </h2>
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <button
                    onClick={() => setMore(false)}
                    className="flex size-10 items-center justify-center rounded-md hover:bg-secondary"
                    aria-label="Close menu"
                  >
                    <X className="size-5" />
                  </button>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const active = pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setMore(false)}
                      className={`flex min-h-20 flex-col items-start justify-between rounded-md border p-4 text-sm font-semibold ${
                        active ? 'border-pen text-foreground' : 'border-border bg-secondary/40'
                      }`}
                    >
                      <Icon className="size-5" />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </OnboardingProvider>
    </CommandBarProvider>
    </MotionConfig>
  )
}
