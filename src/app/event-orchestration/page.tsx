'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  CalendarClock,
  ClipboardCheck,
  RadioTower,
  Users,
  Sparkles,
  ArrowRight,
  LogIn,
  Rocket,
  Loader2,
  Calendar,
  MapPin,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface EventSummary {
  event_id: string
  name: string
  date: number
  venue: string
  participant_count: number
  status: string
  created_at: number
  task_count: number
  completed_count: number
  director_id: string
}

const pillars = [
  {
    title: 'AI-Powered Setup',
    text: 'Describe your event in plain English – Elixa generates the complete task structure automatically.',
    icon: Sparkles,
  },
  {
    title: 'Phase-Based Workflow',
    text: 'Six standardized phases: Permissions → Venue → Sponsors → Registrations → Volunteers → Go/No-Go.',
    icon: CalendarClock,
  },
  {
    title: 'Role-Based Access',
    text: 'Auto-generated operator codes give volunteers scoped access to only their assigned tasks.',
    icon: Users,
  },
  {
    title: 'Dependency Locking',
    text: 'Tasks unlock automatically when prerequisites are complete – no manual tracking needed.',
    icon: ClipboardCheck,
  },
]

export default function EventOrchestrationPage() {
  const [eventIdInput, setEventIdInput] = useState('')
  const [myEvents, setMyEvents] = useState<EventSummary[]>([])
  const [isLoadingEvents, setIsLoadingEvents] = useState(true)

  // Fetch events on mount
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        // Get stored director ID from session
        const storedSession = localStorage.getItem('elixa:orchestration:session')
        let directorId = ''
        if (storedSession) {
          try {
            const session = JSON.parse(storedSession)
            directorId = session.operator_id
          } catch {
            // Ignore
          }
        }

        // Fetch all events (or filtered by director)
        const response = await fetch(
          directorId ? `/api/orchestration/events?director_id=${directorId}` : '/api/orchestration/events'
        )
        const data = await response.json()

        if (data.success) {
          setMyEvents(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch events:', error)
      } finally {
        setIsLoadingEvents(false)
      }
    }

    fetchEvents()
  }, [])

  return (
    <main
      className="min-h-screen bg-[#06040d] text-slate-100"
      style={{
        backgroundImage:
          'radial-gradient(circle at 20% 10%, rgba(124,58,237,0.24), transparent 35%), radial-gradient(circle at 80% 20%, rgba(168,85,247,0.2), transparent 30%), linear-gradient(120deg, #06040d 0%, #0c0818 45%, #1a1528 100%)',
      }}
    >
      <div className="mx-auto max-w-6xl px-6 pb-20 pt-10 sm:px-10">
        {/* Header */}
        <header className="mb-12">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-purple-300">ELIXA</p>
              <h1 className="text-5xl font-black uppercase tracking-[0.08em] leading-none text-white sm:text-6xl glass-text">
                Event Orchestration
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-slate-300">
                Pre-event task management powered by AI. Describe your event, generate task lists,
                coordinate your team, and hit every checkpoint on time.
              </p>
            </div>
            <Link href="/">
              <Button variant="outline" className="glass-button border-white/20 text-slate-300">
                Back to Command Deck
              </Button>
            </Link>
          </div>
        </header>

        {/* Action Cards */}
        <section className="mb-12 grid gap-4 sm:grid-cols-2">
          {/* Create Event Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Link href="/event-orchestration/setup">
              <Card className="group h-full border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-purple-500/10 text-slate-100 glass-card-hover">
                <CardHeader>
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 text-white glass-button">
                    <Sparkles className="h-7 w-7" />
                  </div>
                  <CardTitle className="flex items-center justify-between text-2xl text-white glass-text">
                    Create New Event
                    <ArrowRight className="h-5 w-5 text-purple-300 transition group-hover:translate-x-1" />
                  </CardTitle>
                  <CardDescription className="text-slate-300">
                    Describe your event and let AI generate the complete task structure with phases,
                    roles, and dependencies.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-purple-300">
                    <Rocket className="h-4 w-4" />
                    Get started in under 2 minutes
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>

          {/* Join Event Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="h-full glass-card text-slate-100">
              <CardHeader>
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl glass-button text-slate-300">
                  <LogIn className="h-7 w-7" />
                </div>
                <CardTitle className="text-2xl text-white glass-text">Join Existing Event</CardTitle>
                <CardDescription className="text-slate-300">
                  Have an event ID? Enter it below to access the volunteer portal or dashboard.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={eventIdInput}
                    onChange={(e) => setEventIdInput(e.target.value)}
                    placeholder="Enter Event ID (e.g., orch_1234...)"
                    className="flex-1 rounded-lg glass-input px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                  />
                </div>
                <div className="flex gap-2">
                  <Link
                    href={eventIdInput ? `/event-orchestration/volunteer/${eventIdInput}` : '#'}
                    className="flex-1"
                  >
                    <Button
                      disabled={!eventIdInput}
                      variant="outline"
                      className="w-full glass-button border-white/20 text-slate-300 disabled:opacity-50"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Volunteer Portal
                    </Button>
                  </Link>
                  <Link
                    href={eventIdInput ? `/event-orchestration/dashboard/${eventIdInput}` : '#'}
                    className="flex-1"
                  >
                    <Button
                      disabled={!eventIdInput}
                      className="w-full glass-bright-button text-white disabled:opacity-50"
                    >
                      <RadioTower className="h-4 w-4 mr-2" />
                      Dashboard
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </section>

        {/* My Events Section */}
        {myEvents.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-6 text-sm uppercase tracking-[0.25em] text-purple-300">
              Your Events
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myEvents.map((event, index) => (
                <motion.div
                  key={event.event_id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.07 }}
                >
                  <Link href={`/event-orchestration/dashboard/${event.event_id}`}>
                    <Card className="group h-full glass-card-hover text-slate-100">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <Badge
                            variant="outline"
                            className={
                              event.status === 'completed'
                                ? 'glass-badge-success border-emerald-500/30 text-emerald-300'
                                : 'glass-badge border-violet-500/30 text-violet-300'
                            }
                          >
                            {event.status}
                          </Badge>
                          <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-1 group-hover:text-violet-300" />
                        </div>
                        <CardTitle className="text-lg text-white mt-2 glass-text">{event.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                          {event.date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 text-violet-400" />
                              {new Date(event.date).toLocaleDateString()}
                            </span>
                          )}
                          {event.venue && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-violet-400" />
                              {event.venue}
                            </span>
                          )}
                        </div>

                        {/* Progress bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Progress</span>
                            <span className="text-slate-300">
                              {event.completed_count}/{event.task_count} tasks
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full glass-progress-track">
                            <div
                              className="h-full rounded-full glass-progress-fill transition-all"
                              style={{
                                width: `${event.task_count > 0 ? (event.completed_count / event.task_count) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>

                        {event.completed_count === event.task_count && event.task_count > 0 && (
                          <div className="flex items-center gap-1 text-xs text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            All tasks completed
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Loading state for events */}
        {isLoadingEvents && (
          <section className="mb-12">
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
              <span className="ml-2 text-slate-400">Loading events...</span>
            </div>
          </section>
        )}

        {/* Features Grid */}
        <section>
          <h2 className="mb-6 text-sm uppercase tracking-[0.25em] text-purple-300">
            How It Works
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((pillar, index) => {
              const Icon = pillar.icon
              return (
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.3 + index * 0.07 }}
                  key={pillar.title}
                >
                  <Card className="h-full glass-card text-slate-100">
                    <CardHeader className="pb-2">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg glass-button">
                        <Icon className="h-5 w-5 text-purple-300" />
                      </div>
                      <CardTitle className="text-base text-white glass-text">{pillar.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-400">{pillar.text}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </section>

        {/* Workflow Steps */}
        <section className="mt-12">
          <h2 className="mb-6 text-sm uppercase tracking-[0.25em] text-purple-300">
            The 6-Phase Pipeline
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              { num: 1, label: 'Permissions', desc: 'Approvals & NOCs' },
              { num: 2, label: 'Venue', desc: 'Space & Logistics' },
              { num: 3, label: 'Sponsors', desc: 'Funding & Partners' },
              { num: 4, label: 'Registrations', desc: 'Signups & Tech' },
              { num: 5, label: 'Volunteers', desc: 'Team & Roles' },
              { num: 6, label: 'Go/No-Go', desc: 'Final Review' },
            ].map((phase, i) => (
              <motion.div
                key={phase.num}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + i * 0.05 }}
                className="flex items-center"
              >
                <div className="flex flex-col items-center rounded-xl glass-surface px-4 py-3 text-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full glass-accent text-sm font-bold text-purple-200">
                    <span className="glass-text">{phase.num}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-white glass-text">{phase.label}</p>
                  <p className="text-xs text-slate-500">{phase.desc}</p>
                </div>
                {i < 5 && (
                  <ArrowRight className="mx-1 h-4 w-4 text-slate-600 hidden sm:block" />
                )}
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
