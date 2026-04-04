'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowLeft, Rocket, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlanningChat } from '@/components/orchestration/planning-chat'
import { EventConfigPreview } from '@/components/orchestration/event-config-preview'
import { OperatorCodesDisplay } from '@/components/orchestration/operator-codes-display'
import { generateOperatorCode } from '@/lib/orchestration-agent'

interface CommitResult {
  event_id: string
  name: string
  operators: Array<{
    operator_id: string
    role: string
    label: string
    scope: string[]
  }>
  task_count: number
  phase_count: number
}

export default function OrchestrationSetupPage() {
  const router = useRouter()
  const [configJson, setConfigJson] = useState<string | null>(null)
  const [isCommitting, setIsCommitting] = useState(false)
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null)
  const [directorId, setDirectorId] = useState<string>('')

  // Generate director ID on mount (in a real app, this would come from auth)
  useEffect(() => {
    const storedProfile = localStorage.getItem('elixa:activeProfile')
    if (storedProfile) {
      try {
        const profile = JSON.parse(storedProfile)
        // Use a combination of user info to create director ID
        setDirectorId(generateOperatorCode('director'))
      } catch {
        setDirectorId(generateOperatorCode('director'))
      }
    } else {
      setDirectorId(generateOperatorCode('director'))
    }
  }, [])

  const handleConfigGenerated = (json: string) => {
    setConfigJson(json)
    toast.success('Event configuration generated!')
  }

  const handleLaunchEvent = async () => {
    if (!configJson || isCommitting) return

    setIsCommitting(true)
    try {
      const response = await fetch('/api/orchestration/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configJson,
          description: '', // Could capture the original user input
          directorId,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to launch event')
      }

      setCommitResult(data.data)

      // Store director session in localStorage
      localStorage.setItem(
        'elixa:orchestration:session',
        JSON.stringify({
          operator_id: directorId,
          event_id: data.data.event_id,
          role: 'director',
          scope: ['permissions', 'venue', 'sponsors', 'registrations', 'volunteers', 'gonogo'],
          label: 'Director',
        })
      )

      // Also store this event in the created events list for persistence
      const existingEvents = JSON.parse(localStorage.getItem('elixa:orchestration:my_events') || '[]')
      const newEvent = {
        event_id: data.data.event_id,
        name: data.data.name,
        task_count: data.data.task_count,
        phase_count: data.data.phase_count,
        created_at: Date.now(),
        director_id: directorId,
      }
      // Add to the beginning and keep max 10 events
      existingEvents.unshift(newEvent)
      localStorage.setItem('elixa:orchestration:my_events', JSON.stringify(existingEvents.slice(0, 10)))

      toast.success('Event launched successfully!')
    } catch (error) {
      console.error('Launch error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to launch event')
    } finally {
      setIsCommitting(false)
    }
  }

  const handleGoToDashboard = () => {
    if (commitResult) {
      router.push(`/event-orchestration/dashboard/${commitResult.event_id}`)
    }
  }

  return (
    <main
      className="min-h-screen bg-[#06040d] text-slate-100"
      style={{
        backgroundImage:
          'radial-gradient(circle at 20% 10%, rgba(124,58,237,0.24), transparent 35%), radial-gradient(circle at 80% 20%, rgba(168,85,247,0.2), transparent 30%), linear-gradient(120deg, #06040d 0%, #0c0818 45%, #1a1528 100%)',
      }}
    >
      <div className="mx-auto max-w-4xl px-6 pb-20 pt-10 sm:px-10">
        {/* Header */}
        <header className="mb-8">
          <Link
            href="/event-orchestration"
            className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-purple-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Command Deck
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/30 to-purple-500/30">
              <Sparkles className="h-6 w-6 text-purple-300" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-purple-200">ELIXA</p>
              <h1 className="text-3xl font-bold text-white">Event Setup</h1>
            </div>
          </div>
          <p className="mt-3 text-slate-400">
            Describe your event in plain English. Elixa will generate a complete task structure
            with phases, roles, and dependencies.
          </p>
        </header>

        {/* Main Content */}
        {!commitResult ? (
          <div className="space-y-6">
            {/* Planning Chat */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <PlanningChat onConfigGenerated={handleConfigGenerated} />
            </motion.div>

            {/* Config Preview */}
            {configJson && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <EventConfigPreview configJson={configJson} />

                {/* Launch Button */}
                <motion.div
                  className="mt-6 flex justify-center"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <Button
                    size="lg"
                    onClick={handleLaunchEvent}
                    disabled={isCommitting}
                    className="bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-600 hover:to-purple-600 shadow-lg shadow-violet-500/25"
                  >
                    {isCommitting ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Launching Event...
                      </>
                    ) : (
                      <>
                        <Rocket className="h-5 w-5 mr-2" />
                        Launch Event
                      </>
                    )}
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </div>
        ) : (
          /* Success State - Show Operator Codes */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            {/* Success Message */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20"
              >
                <Rocket className="h-8 w-8 text-emerald-400" />
              </motion.div>
              <h2 className="text-2xl font-bold text-emerald-300">Event Launched!</h2>
              <p className="mt-2 text-slate-300">
                <span className="font-medium text-white">{commitResult.name}</span> is ready with{' '}
                {commitResult.task_count} tasks across {commitResult.phase_count} phases.
              </p>
            </div>

            {/* Operator Codes */}
            <OperatorCodesDisplay
              operators={commitResult.operators as any}
              eventId={commitResult.event_id}
              eventName={commitResult.name}
            />

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                onClick={handleGoToDashboard}
                className="bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-600 hover:to-purple-600"
              >
                Go to Dashboard
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  setConfigJson(null)
                  setCommitResult(null)
                }}
                className="border-white/20 text-slate-300 hover:bg-white/10"
              >
                Create Another Event
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </main>
  )
}
