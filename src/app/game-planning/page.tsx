'use client'

import { useState, useCallback, useRef, useEffect, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Mic,
  MicOff,
  Sparkles,
  Users,
  Zap,
  Timer,
  Undo2,
  Redo2,
  Volume2,
  Brain,
  Play,
  Loader2,
  Send,
  Trophy,
  ChevronDown,
  ChevronUp,
  Megaphone,
  History,
  StopCircle,
  Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Leaderboard } from '@/components/leaderboard'
import { ConfirmationCard } from '@/components/confirmation-card'
import { TimerDisplay } from '@/components/timer-display'
import { AnnouncementBanner } from '@/components/announcement-banner'
import { ActivityFeed, actionsToEntry, type ActivityEntry } from '@/components/activity-feed'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { matchPattern } from '@/lib/pattern-matcher'
import { getTeamColor, getAvatarUrl } from '@/lib/avatar'
import type { LiveState, Team, AgentResponse, AgentProposal, VoiceAction } from '@/types'

// ==============================
// State Helpers
// ==============================

const createInitialState = (): LiveState => ({
  event_id: `event_${Date.now()}`,
  teams: [],
  scoring_mode: 'numeric',
  round: 1,
  total_rounds: 3,
  round_state: 'not_started',
  timer: { state: 'idle' },
  sudden_death: false,
})

const generateId = (name: string, existing: Set<string>): string => {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 32) || 'team'
  let id = base
  let n = 0
  while (existing.has(id)) {
    n += 1
    id = `${base}_${n}`
  }
  return id
}

// Quick command chips
const QUICK_COMMANDS = [
  { label: 'Add 5 Teams', command: 'add 5 teams' },
  { label: 'Start Round 1', command: 'start round 1' },
  { label: 'Next Round', command: 'next round' },
  { label: 'Timer 5min', command: 'start timer 5 minutes' },
  { label: 'Undo', command: 'undo' },
]

const GAME_ID = 'game-planning'

type ActiveProfile = {
  uid: string
  email?: string
  displayName?: string
}

type GameSessionSummary = {
  session_id: string
  session_name: string
  updated_at: number
}

const normalizeLiveState = (input: LiveState): LiveState => ({
  ...input,
  total_rounds: input.total_rounds ?? 3,
  round_state: input.round_state ?? 'not_started',
})

// ==============================
// Main Component
// ==============================

export default function HomePage() {
  const [activeProfile, setActiveProfile] = useState<ActiveProfile | null>(null)
  const [sessions, setSessions] = useState<GameSessionSummary[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [manualSaveLoading, setManualSaveLoading] = useState(false)

  // ===== Phase State =====
  const [setupPhase, setSetupPhase] = useState<'setup' | 'compiling' | 'live' | 'ended'>('setup')
  const [eventDescription, setEventDescription] = useState('')
  const [compiledRules, setCompiledRules] = useState<Record<string, unknown> | null>(null)

  // ===== Live State =====
  const [state, setState] = useState<LiveState>(createInitialState())
  const [isProcessing, setIsProcessing] = useState(false)
  const [typedCommand, setTypedCommand] = useState('')
  const [lastTranscript, setLastTranscript] = useState('')
  const [agentTrace, setAgentTrace] = useState('')
  const [pendingProposal, setPendingProposal] = useState<AgentProposal | null>(null)
  const [pendingActions, setPendingActions] = useState<VoiceAction[]>([])
  const [activeAnnouncement, setActiveAnnouncement] = useState<string | null>(null)
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([])
  const [postEventSummary, setPostEventSummary] = useState<Record<string, unknown> | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  // ===== Collapsed Sections =====
  const [showTrace, setShowTrace] = useState(false)
  const [showTranscript, setShowTranscript] = useState(true)
  const [showActivity, setShowActivity] = useState(true)

  // ===== Refs =====
  const stateRef = useRef<LiveState>(state)
  const historyRef = useRef<LiveState[]>([])
  const futureRef = useRef<LiveState[]>([])
  const commandInputRef = useRef<HTMLInputElement>(null)

  const getPersistPayload = useCallback(() => {
    return {
      state: stateRef.current,
      eventDescription,
      compiledRules,
      setupPhase,
      activityLog,
      agentTrace,
      lastTranscript,
      savedAt: Date.now(),
    }
  }, [eventDescription, compiledRules, setupPhase, activityLog, agentTrace, lastTranscript])

  const refreshSessions = useCallback(async (uid: string) => {
    try {
      const response = await fetch('/api/persist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'list_game_sessions',
          userId: uid,
          gameId: GAME_ID,
        }),
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to load sessions')
      }

      const nextSessions = (result.data?.sessions || []) as GameSessionSummary[]
      setSessions(nextSessions)

      if (!selectedSessionId && nextSessions.length > 0) {
        setSelectedSessionId(nextSessions[0].session_id)
      }
    } catch (error) {
      console.warn('Unable to list sessions:', error)
    }
  }, [selectedSessionId])

  const saveCurrentSession = useCallback(async (manual = false) => {
    if (!activeSessionId || !activeProfile?.uid) {
      return
    }

    if (manual) {
      setManualSaveLoading(true)
    }

    try {
      const response = await fetch('/api/persist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_game_session',
          sessionId: activeSessionId,
          userId: activeProfile.uid,
          data: getPersistPayload(),
        }),
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to save session')
      }

      if (manual) {
        toast.success('Progress saved to session')
      }

      void refreshSessions(activeProfile.uid)
    } catch (error) {
      console.warn('Session save failed:', error)
      if (manual) {
        toast.error('Could not save progress')
      }
    } finally {
      if (manual) {
        setManualSaveLoading(false)
      }
    }
  }, [activeSessionId, activeProfile?.uid, getPersistPayload, refreshSessions])

  const createSessionForCurrentUser = useCallback(async (name?: string) => {
    if (!activeProfile?.uid) {
      toast.error('Sign in from the landing page first.')
      return null
    }

    try {
      const response = await fetch('/api/persist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_game_session',
          userId: activeProfile.uid,
          gameId: GAME_ID,
          sessionName: name || `Game Session ${new Date().toLocaleString()}`,
          data: getPersistPayload(),
        }),
      })

      const result = await response.json()
      if (!result.success || !result.data?.session) {
        throw new Error(result.error || 'Failed to create session')
      }

      const nextSession = result.data.session as GameSessionSummary
      setActiveSessionId(nextSession.session_id)
      setSelectedSessionId(nextSession.session_id)
      await refreshSessions(activeProfile.uid)
      return nextSession.session_id
    } catch (error) {
      console.error('Session creation failed:', error)
      toast.error('Could not create session')
      return null
    }
  }, [activeProfile?.uid, getPersistPayload, refreshSessions])

  const loadSessionIntoState = useCallback(async (sessionIdToLoad: string) => {
    if (!activeProfile?.uid || !sessionIdToLoad) {
      return
    }

    try {
      const response = await fetch('/api/persist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'load_game_session',
          sessionId: sessionIdToLoad,
          userId: activeProfile.uid,
        }),
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to load session')
      }

      const progress = result.data?.session?.progress as
        | {
            state?: LiveState
            eventDescription?: string
            compiledRules?: Record<string, unknown> | null
            setupPhase?: 'setup' | 'compiling' | 'live' | 'ended'
            activityLog?: ActivityEntry[]
            agentTrace?: string
            lastTranscript?: string
          }
        | undefined

      if (!progress?.state) {
        toast.info('Session exists but has no saved progress yet.')
        setActiveSessionId(sessionIdToLoad)
        return
      }

      const normalizedState = normalizeLiveState(progress.state)
      setState(normalizedState)
      setEventDescription(progress.eventDescription || '')
      setCompiledRules(progress.compiledRules || null)
      setSetupPhase(progress.setupPhase || 'setup')
      setActivityLog(progress.activityLog || [])
      setAgentTrace(progress.agentTrace || '')
      setLastTranscript(progress.lastTranscript || '')
      setActiveSessionId(sessionIdToLoad)
      stateRef.current = normalizedState
      toast.success('Session restored')
    } catch (error) {
      console.error('Session load failed:', error)
      toast.error('Could not load session')
    }
  }, [activeProfile?.uid])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    const rawProfile = localStorage.getItem('elixa:activeProfile')
    if (!rawProfile) {
      return
    }

    try {
      const profile = JSON.parse(rawProfile) as ActiveProfile
      if (profile?.uid) {
        setActiveProfile(profile)
      }
    } catch {
      console.warn('Invalid active profile in localStorage')
    }
  }, [])

  useEffect(() => {
    if (!activeProfile?.uid) {
      return
    }

    void refreshSessions(activeProfile.uid)
  }, [activeProfile?.uid, refreshSessions])

  // ===== Speech Recognition =====
  const { isListening, lastError: speechError, start: startListening, stop: stopListening } = useSpeechRecognition(
    (transcript) => {
      if (!isProcessing) {
        void handleVoiceCommand(transcript)
      }
    }
  )

  // ===== Persist state to session store (debounced) =====
  const persistRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (setupPhase !== 'live' || !activeSessionId || !activeProfile?.uid) return
    if (persistRef.current) clearTimeout(persistRef.current)
    persistRef.current = setTimeout(() => {
      void saveCurrentSession(false)
    }, 2000)
    return () => { if (persistRef.current) clearTimeout(persistRef.current) }
  }, [state, setupPhase, eventDescription, compiledRules, activeSessionId, activeProfile?.uid, saveCurrentSession])

  // ===== Apply Actions =====
  const applyActions = useCallback((actions: VoiceAction[]) => {
    setState((prev) => {
      historyRef.current.push(structuredClone(prev))
      if (historyRef.current.length > 50) historyRef.current.shift()
      futureRef.current = []

      let newState = structuredClone(prev)

      for (const action of actions) {
        switch (action.action) {
          case 'add_participants': {
            if ('teams' in action && Array.isArray(action.teams)) {
              const existingIds = new Set(newState.teams.map((t) => t.id))
              const newTeams: Team[] = action.teams.map((t, i) => {
                const id = t.id && !existingIds.has(t.id) ? t.id : generateId(t.name, existingIds)
                existingIds.add(id)
                const color = t.color || getTeamColor(newState.teams.length + i)
                return {
                  id, name: t.name, score: t.score || 0, color,
                  avatar_url: getAvatarUrl(id, 'bottts', { backgroundColor: color }),
                  live_status: 'active', created_at: Date.now(), updated_at: Date.now(),
                } as Team
              })
              newState.teams = [...newState.teams, ...newTeams]
            } else if ('count' in action) {
              const count = action.count as number
              const existingIds = new Set(newState.teams.map((t) => t.id))
              const newTeams: Team[] = Array.from({ length: count }, (_, i) => {
                const name = `Team ${newState.teams.length + i + 1}`
                const id = generateId(name, existingIds)
                existingIds.add(id)
                const color = getTeamColor(newState.teams.length + i)
                return {
                  id, name, score: 0, color,
                  avatar_url: getAvatarUrl(id, 'bottts', { backgroundColor: color }),
                  live_status: 'active', created_at: Date.now(), updated_at: Date.now(),
                } as Team
              })
              newState.teams = [...newState.teams, ...newTeams]
            }
            break
          }

          case 'update_score': {
            if (newState.round_state === 'completed') {
              toast.info('All rounds are complete. Start a new event or update rounds to continue scoring.')
              break
            }

            const ti = newState.teams.findIndex((t) => t.id === action.id)
            if (ti >= 0) {
              // Check freeze status
              if (newState.teams[ti].live_status === 'frozen') {
                // Frozen teams get delta = 0
                toast.info(`${newState.teams[ti].name} is frozen — no score change`)
              } else {
                newState.teams[ti].score += action.delta
                newState.teams[ti].updated_at = Date.now()
              }
            }
            break
          }

          case 'set_score': {
            if (newState.round_state === 'completed') {
              toast.info('All rounds are complete. Start a new event or update rounds to continue scoring.')
              break
            }

            const ti = newState.teams.findIndex((t) => t.id === action.id)
            if (ti >= 0) {
              newState.teams[ti].score = action.score
              newState.teams[ti].updated_at = Date.now()
            }
            break
          }

          case 'rename_team': {
            const ti = newState.teams.findIndex((t) => t.id === action.id)
            if (ti >= 0) {
              newState.teams[ti].name = action.new_name
              newState.teams[ti].updated_at = Date.now()
            }
            break
          }

          case 'freeze_team': {
            const ti = newState.teams.findIndex((t) => t.id === action.id)
            if (ti >= 0) {
              newState.teams[ti].live_status = 'frozen'
              newState.teams[ti].freeze_until = action.until
              newState.teams[ti].updated_at = Date.now()
            }
            break
          }

          case 'thaw_team': {
            const ti = newState.teams.findIndex((t) => t.id === action.id)
            if (ti >= 0) {
              newState.teams[ti].live_status = 'active'
              newState.teams[ti].freeze_until = undefined
              newState.teams[ti].updated_at = Date.now()
            }
            break
          }

          case 'eliminate_team':
          case 'disqualify_team': {
            const ti = newState.teams.findIndex((t) => t.id === action.id)
            if (ti >= 0) {
              newState.teams[ti].live_status = action.action === 'disqualify_team' ? 'disqualified' : 'eliminated'
              newState.teams[ti].updated_at = Date.now()
            }
            break
          }

          case 'revive_team': {
            const ti = newState.teams.findIndex((t) => t.id === action.id)
            if (ti >= 0) {
              newState.teams[ti].live_status = 'active'
              newState.teams[ti].updated_at = Date.now()
            }
            break
          }

          case 'timer': {
            if (action.state === 'start') {
              const dur = action.duration || 60
              newState.timer = {
                state: 'running',
                duration_sec: dur,
                ends_at: Date.now() + dur * 1000,
              }
            } else if (action.state === 'stop' || action.state === 'reset') {
              newState.timer = { state: 'idle', duration_sec: newState.timer.duration_sec }
            } else if (action.state === 'pause') {
              if (newState.timer.state === 'running' && newState.timer.ends_at) {
                const remaining = Math.max(0, newState.timer.ends_at - Date.now())
                newState.timer = { ...newState.timer, state: 'paused', duration_sec: Math.ceil(remaining / 1000) }
              }
            }
            break
          }

          case 'start_round': {
            const targetRound = Math.max(1, Math.min(action.round, newState.total_rounds))
            newState.round = targetRound
            newState.round_state = 'in_progress'
            break
          }

          case 'end_round': {
            if (newState.round_state === 'not_started') {
              newState.round_state = 'in_progress'
              break
            }

            if (newState.round >= newState.total_rounds) {
              newState.round = newState.total_rounds
              newState.round_state = 'completed'
              newState.timer = { state: 'idle', duration_sec: newState.timer.duration_sec }
            } else {
              newState.round += 1
              newState.round_state = 'in_progress'
            }

            // Tick timed effects
            newState.teams = newState.teams.map(t => {
              const next = { ...t }
              if (next.shield_rounds_remaining && next.shield_rounds_remaining > 0) {
                next.shield_rounds_remaining -= 1
                if (next.shield_rounds_remaining === 0 && next.live_status === 'shielded') {
                  next.live_status = 'active'
                }
              }
              if (next.cursed_rounds_remaining && next.cursed_rounds_remaining > 0) {
                next.cursed_rounds_remaining -= 1
                if (next.cursed_rounds_remaining === 0 && next.live_status === 'cursed') {
                  next.live_status = 'active'
                }
              }
              // Unfreeze teams with end_of_round
              if (next.live_status === 'frozen' && next.freeze_until === 'end_of_round') {
                next.live_status = 'active'
                next.freeze_until = undefined
              }
              return next
            })
            break
          }

          case 'set_total_rounds': {
            const total = Math.max(1, Math.min(action.total_rounds, 20))
            newState.total_rounds = total

            if (newState.round > total) {
              newState.round = total
            }

            if (newState.round_state === 'completed' && newState.round < total) {
              newState.round_state = 'in_progress'
            }

            break
          }

          case 'create_announcement': {
            setActiveAnnouncement(action.message)
            break
          }

          case 'manual_correction': {
            const ti = newState.teams.findIndex((t) => t.id === action.team_id)
            if (ti >= 0) {
              newState.teams[ti].score = action.new_score
              newState.teams[ti].updated_at = Date.now()
            }
            break
          }

          case 'undo': {
            if (historyRef.current.length > 0) {
              futureRef.current.push(structuredClone(newState))
              newState = historyRef.current.pop()!
            }
            break
          }

          case 'redo': {
            if (futureRef.current.length > 0) {
              historyRef.current.push(structuredClone(newState))
              newState = futureRef.current.pop()!
            }
            break
          }

          case 'change_mode': {
            newState.scoring_mode = action.mode
            if (action.target) newState.goal_target = action.target
            if (action.label) newState.goal_label = action.label
            break
          }
        }
      }

      stateRef.current = newState
      return newState
    })
  }, [])

  // Persist score events to MongoDB
  const persistScoreEvent = useCallback(async (actions: VoiceAction[], source: string) => {
    if (!activeProfile?.uid) {
      return
    }

    for (const action of actions) {
      if (action.action === 'update_score' || action.action === 'set_score') {
        try {
          await fetch('/api/persist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'save_score_event',
              sessionId: activeSessionId || stateRef.current.event_id,
              userId: activeProfile.uid,
              data: {
                ...action,
                source,
                round: stateRef.current.round,
                timestamp: Date.now(),
              },
            }),
          })
        } catch (e) {
          console.warn('Score persist failed:', e)
        }
      }
    }
  }, [activeSessionId, activeProfile?.uid])

  // ===== Handle Voice Command (core routing) =====
  const handleVoiceCommand = useCallback(async (transcript: string) => {
    setLastTranscript(transcript)
    const currentState = stateRef.current

    // Step 1: Try pattern matching first (fast, local, <50ms)
    const patternResult = matchPattern(transcript, currentState)

    if (patternResult.matched) {
      setAgentTrace(`Pattern Match (instant)\n\nMatched: "${transcript}"\nActions: ${JSON.stringify(patternResult.actions, null, 2)}`)
      applyActions(patternResult.actions)

      // Add to activity log
      const entry = actionsToEntry(patternResult.actions, 'pattern', currentState.teams)
      if (entry) setActivityLog(prev => [entry, ...prev])

      // Persist score events
      void persistScoreEvent(patternResult.actions, 'pattern')

      // Speak commentary
      if (patternResult.commentary) {
        void speakCommentary(patternResult.commentary)
      }

      toast.success('Command executed')
      return
    }

    // Step 2: No pattern match — call Gemini agent
    setIsProcessing(true)
    setAgentTrace('Calling Gemini agent...')

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: transcript,
          liveState: currentState,
          ruleManifest: currentState.rule_manifest,
          conversationHistory: activityLog.slice(0, 10).map(e => e.description),
        }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Agent call failed')
      }

      const agentResponse: AgentResponse = result.data.response

      // Build trace
      const trace = [
        agentResponse.thought && `Thought: ${agentResponse.thought}`,
        agentResponse.observation && `Observation: ${agentResponse.observation}`,
        `\nActions: ${JSON.stringify(agentResponse.actions, null, 2)}`,
      ].filter(Boolean).join('\n')

      setAgentTrace(`Gemini Agent Response\n\n${trace}`)

      // Log agent call to MongoDB
      fetch('/api/persist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_agent_log',
          sessionId: activeSessionId || currentState.event_id,
          userId: activeProfile?.uid,
          data: {
            command: transcript,
            response: agentResponse,
            timestamp: Date.now(),
          },
        }),
      }).catch((e) => console.warn('Agent log persist failed:', e))

      // Check for proposal requiring confirmation
      if (agentResponse.proposal) {
        setPendingProposal(agentResponse.proposal)
        setPendingActions(agentResponse.actions)
        return
      }

      // Apply actions directly
      if (agentResponse.actions.length > 0) {
        applyActions(agentResponse.actions)
        void persistScoreEvent(agentResponse.actions, 'agent')

        const entry = actionsToEntry(agentResponse.actions, 'agent', currentState.teams)
        if (entry) setActivityLog(prev => [entry, ...prev])

        toast.success('Agent command executed')
      }

      // Speak commentary
      if (agentResponse.commentary) {
        void speakCommentary(agentResponse.commentary)
      }
    } catch (error) {
      console.error('Agent error:', error)
      setAgentTrace(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      toast.error('Failed to process command')
    } finally {
      setIsProcessing(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyActions, persistScoreEvent, activityLog, activeSessionId, activeProfile?.uid])

  // ===== Text Command Submit =====
  const handleTextCommandSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const command = typedCommand.trim()
    if (!command || isProcessing) return
    setTypedCommand('')
    void handleVoiceCommand(command)
  }, [typedCommand, isProcessing, handleVoiceCommand])

  // ===== Speech (ElevenLabs + fallback) =====
  const speakCommentary = useCallback(async (text: string) => {
    try {
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const result = await response.json()
      if (result.data?.audio) {
        const audio = new Audio(`data:audio/mpeg;base64,${result.data.audio}`)
        audio.play()
      } else {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.rate = 1.1
        speechSynthesis.speak(utterance)
      }
    } catch {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.1
      speechSynthesis.speak(utterance)
    }
  }, [])

  // ===== Proposal Handlers =====
  const handleConfirmProposal = useCallback(() => {
    if (pendingActions.length > 0) {
      applyActions(pendingActions)
      void persistScoreEvent(pendingActions, 'agent')

      const entry = actionsToEntry(pendingActions, 'agent', stateRef.current.teams)
      if (entry) setActivityLog(prev => [entry, ...prev])

      toast.success('Changes applied')
    }
    setPendingProposal(null)
    setPendingActions([])
  }, [pendingActions, applyActions, persistScoreEvent])

  const handleCancelProposal = useCallback(() => {
    setPendingProposal(null)
    setPendingActions([])
    toast.info('Changes cancelled')
  }, [])

  // ===== Undo/Redo =====
  const canUndo = historyRef.current.length > 0
  const canRedo = futureRef.current.length > 0

  const handleUndo = useCallback(() => {
    applyActions([{ action: 'undo' }])
    toast.info('Undone')
    setActivityLog(prev => [{
      id: `undo_${Date.now()}`, timestamp: Date.now(), action: 'undo', description: 'Last action undone', source: 'pattern',
    }, ...prev])
  }, [applyActions])

  const handleRedo = useCallback(() => {
    applyActions([{ action: 'redo' }])
    toast.info('Redone')
  }, [applyActions])

  // ===== Setup Phase Handlers =====
  const handleCompileRules = async () => {
    if (!eventDescription.trim()) {
      toast.error('Please enter an event description')
      return
    }
    setSetupPhase('compiling')
    try {
      const response = await fetch('/api/compile-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: eventDescription }),
      })
      if (!response.ok) throw new Error('Failed to compile rules')
      const data = await response.json()
      setCompiledRules(data.data.manifest)
      toast.success('Rules compiled successfully! Review below.')
    } catch (error) {
      toast.error('Failed to compile rules. Starting without compiled rules.')
      console.error('Rule compilation error:', error)
    } finally {
      setSetupPhase('setup')
    }
  }

  const handleStartEvent = async () => {
    let targetSessionId = activeSessionId
    if (!targetSessionId) {
      targetSessionId = await createSessionForCurrentUser(
        eventDescription.trim() ? `${eventDescription.trim().slice(0, 40)}...` : undefined
      )
    }

    if (!targetSessionId) {
      return
    }

    setState((prev) => ({
      ...prev,
      event_id: `event_${Date.now()}`,
    }))
    setActiveSessionId(targetSessionId)
    setSetupPhase('live')
    toast.success('Event started! Use voice commands to manage.')
  }

  const handleEndEvent = async () => {
    setSetupPhase('ended')
    stopListening()
    setSummaryLoading(true)
    try {
      const response = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: state.event_id,
          eventName: eventDescription || 'Event',
          teams: state.teams,
          rounds: state.total_rounds,
        }),
      })
      const result = await response.json()
      if (result.success) {
        setPostEventSummary(result.data)
      }
    } catch (e) {
      console.error('Summary failed:', e)
    } finally {
      setSummaryLoading(false)
    }
  }

  const handleNewEvent = () => {
    setState(createInitialState())
    setActivityLog([])
    setAgentTrace('')
    setLastTranscript('')
    setPostEventSummary(null)
    setCompiledRules(null)
    setEventDescription('')
    setSetupPhase('setup')
    historyRef.current = []
    futureRef.current = []
  }

  // ===== Keyboard shortcut =====
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); handleUndo() }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); handleRedo() }
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        commandInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo])

  // =================================================
  // RENDER: Post-Event Summary
  // =================================================
  if (setupPhase === 'ended') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-3xl space-y-6"
        >
          <Card className="border-2 border-primary/20 shadow-xl glass-card">
            <CardHeader className="text-center space-y-3">
              <div className="flex justify-center">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 glass-button">
                  <Trophy className="w-10 h-10 text-primary" />
                </div>
              </div>
              <CardTitle className="text-3xl glass-text">Event Complete!</CardTitle>
              <CardDescription>Here&apos;s your post-event summary</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Winner */}
              {state.teams.length > 0 && (
                <div className="text-center p-6 rounded-xl glass-surface border border-amber-200/20">
                  <p className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-1">Winner</p>
                  <p className="text-2xl font-bold glass-text">
                    🏆 {[...state.teams].sort((a, b) => b.score - a.score)[0]?.name}
                  </p>
                  <p className="text-lg font-mono text-amber-300">
                    {[...state.teams].sort((a, b) => b.score - a.score)[0]?.score} points
                  </p>
                </div>
              )}

              {/* Final Standings */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Final Standings</h3>
                <div className="space-y-1.5">
                  {[...state.teams].sort((a, b) => b.score - a.score).map((team, i) => (
                    <div key={team.id} className="flex items-center justify-between p-3 rounded-lg glass-card-hover">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold glass-button text-primary">
                          {i + 1}
                        </span>
                        <span className="font-medium">{team.name}</span>
                      </div>
                      <span className="font-mono font-bold">{team.score}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Summary */}
              {summaryLoading && (
                <div className="flex items-center justify-center gap-2 p-6">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Generating AI summary...</span>
                </div>
              )}

              {postEventSummary && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl glass-surface border border-primary/20">
                    <h3 className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
                      <Brain className="w-4 h-4" />
                      AI Summary
                    </h3>
                    <p className="text-sm leading-relaxed">{String(postEventSummary.summary || '')}</p>
                  </div>

                  {Array.isArray(postEventSummary.highlights) && postEventSummary.highlights.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-2">Highlights</h3>
                      <ul className="space-y-1.5">
                        {(postEventSummary.highlights as string[]).map((h, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                            {h}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button onClick={handleNewEvent} className="flex-1">
                  <Sparkles className="w-4 h-4" />
                  New Event
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  // =================================================
  // RENDER: Setup Screen
  // =================================================
  if (setupPhase !== 'live') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl"
        >
          <Card className="border-2 shadow-xl glass-card">
            <CardHeader className="text-center space-y-3">
              <div className="flex justify-center">
                <motion.div
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                  className="flex items-center gap-2 font-bold text-4xl"
                >
                  <Sparkles className="w-10 h-10 text-primary" />
                  <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent glass-text">
                    Elixa
                  </span>
                </motion.div>
              </div>
              <CardTitle className="text-2xl">Setup Your Event</CardTitle>
              <CardDescription className="max-w-md mx-auto">
                Describe your game, quiz, or competition in natural language. AI will compile rules and power voice commands.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Session</p>
                  <p className="text-xs text-muted-foreground">
                    {activeProfile?.displayName || activeProfile?.email || 'Not signed in'}
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                  >
                    <option value="">Select a saved session</option>
                    {sessions.map((session) => (
                      <option key={session.session_id} value={session.session_id}>
                        {session.session_name}
                      </option>
                    ))}
                  </select>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={!selectedSessionId}
                    onClick={() => void loadSessionIntoState(selectedSessionId)}
                  >
                    Load Session
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void createSessionForCurrentUser()}
                  >
                    New Session
                  </Button>
                </div>

                {activeSessionId && (
                  <p className="text-xs text-muted-foreground">Active session ID: {activeSessionId}</p>
                )}
              </div>

              {/* Event Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="event-description">Event Description</label>
                <textarea
                  id="event-description"
                  className="w-full min-h-[180px] px-4 py-3 rounded-xl glass-input text-sm resize-y transition-all duration-300"
                  placeholder="Describe your event... For example:\n\nA trivia quiz with 5 rounds. Teams earn 10 points for correct answers and lose 5 for wrong ones. Top 3 teams advance. Freeze punishment for repeated wrong answers."
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="round-count">Total Rounds</label>
                <input
                  id="round-count"
                  type="number"
                  min={1}
                  max={20}
                  className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={state.total_rounds}
                  onChange={(e) => {
                    const next = Number.parseInt(e.target.value, 10)
                    const safe = Number.isFinite(next) ? Math.max(1, Math.min(next, 20)) : 1
                    setState((prev) => ({ ...prev, total_rounds: safe, round: Math.min(prev.round, safe) }))
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Voice command also works: &quot;change rounds to 4&quot;.
                </p>
              </div>

              {/* Compiled Rules Preview */}
              {compiledRules && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Brain className="w-4 h-4 text-primary" />
                      Compiled Rules
                    </label>
                    <Button variant="ghost" size="sm" onClick={() => setCompiledRules(null)}>Clear</Button>
                  </div>
                  <textarea
                    className="w-full min-h-[250px] px-3 py-2 rounded-xl border border-input bg-muted/30 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                    value={JSON.stringify(compiledRules, null, 2)}
                    onChange={(e) => {
                      try { setCompiledRules(JSON.parse(e.target.value)) } catch { /* invalid */ }
                    }}
                  />
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">
                      {(compiledRules as Record<string, unknown[]>).triggers?.length || 0} triggers
                    </Badge>
                    <Badge variant="secondary">
                      {(compiledRules as Record<string, unknown[]>).statusValues?.length || 0} status values
                    </Badge>
                  </div>
                </motion.div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={handleCompileRules}
                  disabled={setupPhase === 'compiling' || !eventDescription.trim()}
                  className="flex-1"
                  variant="outline"
                >
                  {setupPhase === 'compiling' ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Compiling...</>
                  ) : (
                    <><Brain className="w-4 h-4" />Compile Rules</>
                  )}
                </Button>
                <Button onClick={handleStartEvent} className="flex-1">
                  <Play className="w-4 h-4" />
                  Start Event
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                You can start without compiling rules — AI adapts to your commands in real-time.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  // =================================================
  // RENDER: Live Event
  // =================================================
  return (
    <div className="min-h-screen flex flex-col">
      {/* Announcement Banner */}
      <AnnouncementBanner
        message={activeAnnouncement}
        onDismiss={() => setActiveAnnouncement(null)}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="flex items-center justify-between h-14 px-4 max-w-[1600px] mx-auto">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 font-bold text-lg">
              <Sparkles className="w-4.5 h-4.5 text-primary" />
              <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                Elixa
              </span>
            </div>
            <Badge variant="secondary" className="hidden sm:flex text-[10px]">
              LIVE
            </Badge>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
            {activeSessionId && (
              <Badge variant="outline" className="hidden md:inline-flex">Session Active</Badge>
            )}
            <div className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Round</span> {state.round}/{state.total_rounds}
            </div>
            <Badge variant={state.round_state === 'completed' ? 'destructive' : 'secondary'} className="hidden sm:inline-flex text-[10px]">
              {state.round_state === 'not_started' ? 'ROUND PENDING' : state.round_state === 'in_progress' ? 'ROUND LIVE' : 'ROUNDS COMPLETE'}
            </Badge>
            <div className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              <span>{state.teams.length}</span>
              <span className="hidden sm:inline">teams</span>
            </div>
            {state.sudden_death && (
              <Badge variant="destructive" className="text-[10px]">SUDDEN DEATH</Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={() => void saveCurrentSession(true)}
              disabled={!activeSessionId || manualSaveLoading}
            >
              {manualSaveLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline ml-1">Save</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive h-8 px-2"
              onClick={handleEndEvent}
            >
              <StopCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline ml-1">End</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 max-w-[1600px] mx-auto w-full grid grid-cols-1 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] gap-0 lg:gap-0">
        {/* Leaderboard Area */}
        <main className="p-4 sm:p-6 overflow-auto lg:border-r lg:border-border/50">
          {/* Timer */}
          <AnimatePresence>
            {state.timer.state !== 'idle' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4"
              >
                <TimerDisplay timer={state.timer} />
              </motion.div>
            )}
          </AnimatePresence>

          <Leaderboard teams={state.teams} />
        </main>

        {/* Operator Console Sidebar */}
        <aside className="border-t lg:border-t-0 lg:border-l border-border/50 bg-card/50 overflow-y-auto lg:max-h-[calc(100vh-56px)] lg:sticky lg:top-14">
          <div className="p-4 space-y-4">
            {/* Console Header */}
            <div>
              <h2 className="text-base font-bold">Operator Console</h2>
              <p className="text-xs text-muted-foreground">Voice + text controlled event management</p>
            </div>

            {/* Command Input */}
            <form onSubmit={handleTextCommandSubmit} className="flex gap-2">
              <input
                ref={commandInputRef}
                type="text"
                value={typedCommand}
                onChange={(e) => setTypedCommand(e.target.value)}
                placeholder="Type command... (/ to focus)"
                className="flex-1 h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                disabled={isProcessing}
              />
              <Button
                type="submit"
                size="default"
                className="h-10 px-3"
                disabled={isProcessing || typedCommand.trim().length === 0}
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>

            {/* Quick Command Chips */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_COMMANDS.map((qc) => (
                <button
                  key={qc.command}
                  type="button"
                  onClick={() => void handleVoiceCommand(qc.command)}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
                >
                  <Zap className="w-3 h-3" />
                  {qc.label}
                </button>
              ))}
            </div>

            {/* Mic Button */}
            <Button
              size="lg"
              variant={isListening ? 'destructive' : 'default'}
              className="w-full h-12"
              onClick={isListening ? stopListening : startListening}
            >
              {isListening ? (
                <>
                  <motion.span
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    <MicOff className="w-5 h-5" />
                  </motion.span>
                  Stop Listening
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5" />
                  Start Listening
                </>
              )}
            </Button>

            {isListening && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-xs text-success"
              >
                <motion.span
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="w-2 h-2 rounded-full bg-success"
                />
                Listening for commands...
              </motion.div>
            )}

            {speechError && (
              <p className="text-xs text-destructive bg-destructive/10 p-2 rounded-lg">{speechError}</p>
            )}

            {/* Undo/Redo */}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-9" disabled={!canUndo} onClick={handleUndo}>
                <Undo2 className="w-3.5 h-3.5 mr-1" />
                Undo
              </Button>
              <Button variant="outline" className="flex-1 h-9" disabled={!canRedo} onClick={handleRedo}>
                <Redo2 className="w-3.5 h-3.5 mr-1" />
                Redo
              </Button>
            </div>

            {/* Processing Indicator */}
            <AnimatePresence>
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 text-primary"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-medium">Agent processing...</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Pending Proposal */}
            <AnimatePresence>
              {pendingProposal && (
                <ConfirmationCard
                  proposal={pendingProposal}
                  onConfirm={handleConfirmProposal}
                  onCancel={handleCancelProposal}
                  isProcessing={isProcessing}
                />
              )}
            </AnimatePresence>

            {/* Activity Feed */}
            <CollapsibleSection
              title="Activity"
              icon={<History className="w-3.5 h-3.5" />}
              open={showActivity}
              onToggle={() => setShowActivity(!showActivity)}
            >
              <ActivityFeed entries={activityLog} />
            </CollapsibleSection>

            {/* Transcript */}
            <CollapsibleSection
              title="Last Transcript"
              icon={<Volume2 className="w-3.5 h-3.5" />}
              open={showTranscript}
              onToggle={() => setShowTranscript(!showTranscript)}
            >
              <pre className="text-xs font-mono bg-muted p-3 rounded-lg min-h-[40px] whitespace-pre-wrap">
                {lastTranscript || 'Waiting for voice input...'}
              </pre>
            </CollapsibleSection>

            {/* Agent Trace */}
            <CollapsibleSection
              title="Agent Reasoning"
              icon={<Brain className="w-3.5 h-3.5" />}
              open={showTrace}
              onToggle={() => setShowTrace(!showTrace)}
            >
              <pre className="text-[11px] font-mono bg-muted p-3 rounded-lg overflow-auto max-h-[200px] whitespace-pre-wrap">
                {agentTrace || 'No agent activity yet'}
              </pre>
            </CollapsibleSection>
          </div>
        </aside>
      </div>
    </div>
  )
}

// ==============================
// Helper Components
// ==============================

function CollapsibleSection({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string
  icon: React.ReactNode
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors py-1"
      >
        <span className="flex items-center gap-1.5">{icon}{title}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
