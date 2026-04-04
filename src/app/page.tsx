'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CalendarRange, Crown, GanttChartSquare, Rocket } from 'lucide-react'
import { GoogleAuthCard } from '@/components/auth/google-auth-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const modules = [
  {
    id: 'planning',
    title: 'Game Planning',
    description: 'Build rounds, scoring logic, and live moderation flows for competitive events.',
    route: '/game-planning',
    icon: Crown,
    accent: 'from-emerald-300 to-lime-300',
  },
  {
    id: 'orchestration',
    title: 'Event Orchestration',
    description: 'Run timelines, assign tasks, and coordinate cross-team execution in real time.',
    route: '/event-orchestration',
    icon: CalendarRange,
    accent: 'from-violet-400 to-purple-400',
  },
] as const

export default function LandingPage() {
  const [activeModuleId, setActiveModuleId] = useState<(typeof modules)[number]['id']>('planning')

  const activeModule = useMemo(
    () => modules.find((module) => module.id === activeModuleId) || modules[0],
    [activeModuleId]
  )

  return (
    <main
      className="min-h-screen overflow-hidden bg-[#06040d] text-slate-100 font-sans"
      style={{
        backgroundImage:
          'radial-gradient(circle at 20% 10%, rgba(124,58,237,0.24), transparent 35%), radial-gradient(circle at 80% 20%, rgba(168,85,247,0.2), transparent 30%), linear-gradient(120deg, #06040d 0%, #0c0818 45%, #1a1528 100%)',
      }}
    >
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-10 sm:px-10">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-purple-300">ELIXA Command Deck</p>
            <h1 className="text-5xl font-black uppercase tracking-[0.08em] leading-none text-white sm:text-6xl">
              Event Command
            </h1>
          </div>
          <Link href={activeModule.route}>
            <Button className="bg-white text-slate-950 hover:bg-slate-100">Skip To Workspace</Button>
          </Link>
        </header>

        <section className="grid items-start gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/15 bg-[#1a1528]/60 p-6 backdrop-blur-md"
              initial={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.4 }}
            >
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-400/40 bg-purple-400/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-purple-200">
                <Rocket className="h-3.5 w-3.5" />
                Launch Pad
              </p>
              <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">
                One landing hub for planning game mechanics and orchestrating live events.
              </h2>
              <p className="mt-4 max-w-2xl text-slate-300">
                Pick your module, verify identity with Google, and enter your workspace with a validated phone number for organizer contact continuity.
              </p>
            </motion.div>

            <div className="grid gap-4 sm:grid-cols-2">
              {modules.map((module, index) => {
                const Icon = module.icon
                const selected = module.id === activeModuleId
                return (
                  <motion.button
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-2xl border p-5 text-left transition ${
                      selected
                        ? 'border-white/40 bg-white/10 shadow-[0_0_30px_rgba(124,58,237,0.25)]'
                        : 'border-white/15 bg-[#1a1528]/40 hover:border-white/25 hover:bg-[#1a1528]/70'
                    }`}
                    initial={{ opacity: 0, y: 18 }}
                    key={module.id}
                    onClick={() => setActiveModuleId(module.id)}
                    transition={{ duration: 0.35, delay: index * 0.08 }}
                    type="button"
                  >
                    <span
                      className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r ${module.accent} text-slate-900`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="text-xl font-semibold">{module.title}</h3>
                    <p className="mt-2 text-sm text-slate-300">{module.description}</p>
                  </motion.button>
                )
              })}
            </div>

            <Card className="border-white/15 bg-[#1a1528]/40 text-slate-100">
              <CardHeader>
                <CardTitle className="inline-flex items-center gap-2 text-xl">
                  <GanttChartSquare className="h-5 w-5 text-purple-300" />
                  Selected Route
                </CardTitle>
                <CardDescription className="text-slate-300">
                  Continue to {activeModule.title} after sign-in and phone verification.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-purple-200">
                  {activeModule.route}
                </p>
              </CardContent>
            </Card>
          </div>

          <motion.div
            animate={{ opacity: 1, x: 0 }}
            initial={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.45, delay: 0.1 }}
          >
            <GoogleAuthCard targetRoute={activeModule.route} />
          </motion.div>
        </section>
      </div>
    </main>
  )
}
