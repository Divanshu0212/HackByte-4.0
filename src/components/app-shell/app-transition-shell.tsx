'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { usePathname, useSearchParams } from 'next/navigation'
import { CardEffectsBootstrap } from '@/components/app-shell/card-effects-bootstrap'

interface RouteTransitionContextValue {
  beginNavigation: (href?: string) => void
  isNavigating: boolean
}

const RouteTransitionContext = createContext<RouteTransitionContextValue>({
  beginNavigation: () => undefined,
  isNavigating: false,
})

function normalizeRoute(pathname: string, search: string) {
  return `${pathname}${search}`
}

export function useRouteTransition() {
  return useContext(RouteTransitionContext)
}

export function AppTransitionShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const shouldReduceMotion = useReducedMotion()
  const searchKey = searchParams.toString()
  const routeKey = useMemo(
    () => normalizeRoute(pathname, searchKey ? `?${searchKey}` : ''),
    [pathname, searchKey]
  )

  const transitionValue = useMemo(
    () => ({
      beginNavigation: () => undefined,
      isNavigating: false,
    }),
    []
  )

  const pageMotion = shouldReduceMotion
    ? {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit: { opacity: 1 },
      }
    : {
        initial: {
          opacity: 0,
          y: 26,
          scale: 0.992,
          filter: 'blur(10px)',
        },
        animate: {
          opacity: 1,
          y: 0,
          scale: 1,
          filter: 'blur(0px)',
          transition: { duration: 0.62, ease: [0.22, 1, 0.36, 1] },
        },
        exit: {
          opacity: 0,
          y: -18,
          scale: 1.008,
          filter: 'blur(8px)',
          transition: { duration: 0.34, ease: [0.4, 0, 0.2, 1] },
        },
      }

  return (
    <RouteTransitionContext.Provider value={transitionValue}>
      <div className="relative min-h-screen overflow-x-clip">
        <CardEffectsBootstrap />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={routeKey}
            initial={pageMotion.initial}
            animate={pageMotion.animate}
            exit={pageMotion.exit}
            className="min-h-screen will-change-transform"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </RouteTransitionContext.Provider>
  )
}
