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
  Settings,
  Volume2,
  Brain,
  Play,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Leaderboard } from '@/components/leaderboard'
import { ConfirmationCard } from '@/components/confirmation-card'
import { matchPattern } from '@/lib/pattern-matcher'
import { getTeamColor, getAvatarUrl } from '@/lib/avatar'
import type { LiveState, Team, AgentResponse, AgentProposal, VoiceAction } from '@/types'

// Initial state
const createInitialState = (): LiveState => ({
  event_id: `event_${Date.now()}`,
  teams: [],
  scoring_mode: 'numeric',
  round: 1,
  timer: { state: 'idle' },
  sudden_death: false,
})

// Generate unique ID
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

export default function HomePage() {
  const [setupPhase, setSetupPhase] = useState<'setup' | 'compiling' | 'live'>('setup')
  const [eventDescription, setEventDescription] = useState('')
  const [scoringMode, setScoringMode] = useState<'numeric' | 'goal_based' | 'pass_fail'>('numeric')
  const [compiledRules, setCompiledRules] = useState<any>(null)
  const [state, setState] = useState<LiveState>(createInitialState())
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [typedCommand, setTypedCommand] = useState('')
  const [lastTranscript, setLastTranscript] = useState('')
  const [agentTrace, setAgentTrace] = useState('')
  const [pendingProposal, setPendingProposal] = useState<AgentProposal | null>(null)
  const [pendingActions, setPendingActions] = useState<VoiceAction[]>([])
  const stateRef = useRef<LiveState>(state)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const historyRef = useRef<LiveState[]>([])
  const futureRef = useRef<LiveState[]>([])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Speech recognition setup
  useEffect(() => {
    if (typeof window === 'undefined' || setupPhase !== 'live') return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      toast.error('Speech recognition not supported in this browser')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1]
      if (last.isFinal) {
        const transcript = last[0].transcript.trim()
        if (transcript) {
          handleVoiceCommand(transcript)
        }
      }
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        toast.error(`Speech error: ${event.error}`)
        setIsListening(false)
      }
    }

    recognition.onend = () => {
      // Only auto-restart if we're still in listening mode
      setIsListening((listening) => {
        if (listening && setupPhase === 'live') {
          try {
            recognition.start()
          } catch (e) {
            console.error('Failed to restart recognition:', e)
            return false
          }
        }
        return listening
      })
    }

    recognitionRef.current = recognition

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [setupPhase])

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
      toast.info('Stopped listening')
    } else {
      try {
        recognitionRef.current.start()
        setIsListening(true)
        toast.success('Listening for commands...')
      } catch (e) {
        toast.error('Failed to start speech recognition')
      }
    }
  }, [isListening])

  // Apply actions to state
  const applyActions = useCallback((actions: VoiceAction[]) => {
    console.log('[Apply Actions] Applying actions:', actions)
    setState((prev) => {
      console.log('[Apply Actions] Previous state:', prev.teams.length, 'teams')
      // Save to history for undo
      historyRef.current.push(structuredClone(prev))
      futureRef.current = []

      let newState = structuredClone(prev)

      for (const action of actions) {
        switch (action.action) {
          case 'add_participants': {
            if ('teams' in action && Array.isArray(action.teams)) {
              const existingIds = new Set(newState.teams.map((t) => t.id))
              const newTeams: Team[] = action.teams.map((t, i) => {
                const id = t.id && !existingIds.has(t.id)
                  ? t.id
                  : generateId(t.name, existingIds)
                existingIds.add(id)
                const color = t.color || getTeamColor(newState.teams.length + i)
                return {
                  id,
                  name: t.name,
                  score: t.score || 0,
                  color,
                  avatar_url: getAvatarUrl(id, 'bottts', { backgroundColor: color }),
                  live_status: 'active',
                  created_at: Date.now(),
                  updated_at: Date.now(),
                }
              })
              newState.teams = [...newState.teams, ...newTeams]
            } else if ('count' in action) {
              const count = action.count
              const existingIds = new Set(newState.teams.map((t) => t.id))
              const newTeams: Team[] = Array.from({ length: count }, (_, i) => {
                const name = `Team ${newState.teams.length + i + 1}`
                const id = generateId(name, existingIds)
                existingIds.add(id)
                const color = getTeamColor(newState.teams.length + i)
                return {
                  id,
                  name,
                  score: 0,
                  color,
                  avatar_url: getAvatarUrl(id, 'bottts', { backgroundColor: color }),
                  live_status: 'active',
                  created_at: Date.now(),
                  updated_at: Date.now(),
                }
              })
              newState.teams = [...newState.teams, ...newTeams]
            }
            break
          }

          case 'update_score': {
            const teamIndex = newState.teams.findIndex((t) => t.id === action.id)
            if (teamIndex >= 0) {
              newState.teams[teamIndex].score += action.delta
              newState.teams[teamIndex].updated_at = Date.now()
            }
            break
          }

          case 'set_score': {
            const teamIndex = newState.teams.findIndex((t) => t.id === action.id)
            if (teamIndex >= 0) {
              newState.teams[teamIndex].score = action.score
              newState.teams[teamIndex].updated_at = Date.now()
            }
            break
          }

          case 'freeze_team': {
            const teamIndex = newState.teams.findIndex((t) => t.id === action.id)
            if (teamIndex >= 0) {
              newState.teams[teamIndex].live_status = 'frozen'
              newState.teams[teamIndex].freeze_until = action.until
              newState.teams[teamIndex].updated_at = Date.now()
            }
            break
          }

          case 'thaw_team': {
            const teamIndex = newState.teams.findIndex((t) => t.id === action.id)
            if (teamIndex >= 0) {
              newState.teams[teamIndex].live_status = 'active'
              newState.teams[teamIndex].freeze_until = undefined
              newState.teams[teamIndex].updated_at = Date.now()
            }
            break
          }

          case 'eliminate_team':
          case 'disqualify_team': {
            const teamIndex = newState.teams.findIndex((t) => t.id === action.id)
            if (teamIndex >= 0) {
              newState.teams[teamIndex].live_status = action.action === 'disqualify_team' ? 'disqualified' : 'eliminated'
              newState.teams[teamIndex].updated_at = Date.now()
            }
            break
          }

          case 'timer': {
            if (action.state === 'start') {
              newState.timer = {
                state: 'running',
                duration_sec: action.duration || 60,
                ends_at: Date.now() + (action.duration || 60) * 1000,
              }
            } else if (action.state === 'stop' || action.state === 'reset') {
              newState.timer = { state: 'idle', duration_sec: newState.timer.duration_sec }
            } else if (action.state === 'pause') {
              newState.timer = { ...newState.timer, state: 'paused' }
            }
            break
          }

          case 'start_round': {
            newState.round = action.round
            break
          }

          case 'end_round': {
            newState.round += 1
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
        }
      }

      stateRef.current = newState
      console.log('[Apply Actions] New state:', newState.teams.length, 'teams')
      return newState
    })
  }, [])

  // Handle voice command
  const handleVoiceCommand = useCallback(async (transcript: string) => {
    setLastTranscript(transcript)
    const currentState = stateRef.current

    // Step 1: Try pattern matching first (fast, local)
    const patternResult = matchPattern(transcript, currentState)

    if (patternResult.matched) {
      setAgentTrace(`Pattern Match (instant)\n\nMatched: "${transcript}"\nActions: ${JSON.stringify(patternResult.actions, null, 2)}`)
      applyActions(patternResult.actions)

      // Speak commentary
      if (patternResult.commentary) {
        speakCommentary(patternResult.commentary)
      }

      toast.success('Command executed')
      return
    }

    // Step 2: No pattern match - call Gemini agent
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
          conversationHistory: [],
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

      // Check for proposal requiring confirmation
      if (agentResponse.proposal) {
        setPendingProposal(agentResponse.proposal)
        setPendingActions(agentResponse.actions)
        return
      }

      // Apply actions directly
      if (agentResponse.actions.length > 0) {
        applyActions(agentResponse.actions)
        toast.success('Agent command executed')
      }

      // Speak commentary
      if (agentResponse.commentary) {
        speakCommentary(agentResponse.commentary)
      }
    } catch (error) {
      console.error('Agent error:', error)
      setAgentTrace(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      toast.error('Failed to process command')
    } finally {
      setIsProcessing(false)
    }
  }, [applyActions])

  const handleTextCommandSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const command = typedCommand.trim()
    if (!command || isProcessing) return

    setTypedCommand('')
    void handleVoiceCommand(command)
  }, [typedCommand, isProcessing, handleVoiceCommand])

  // Speak commentary using ElevenLabs or fallback
  const speakCommentary = useCallback(async (text: string) => {
    try {
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      const result = await response.json()

      if (result.data?.audio) {
        // Play ElevenLabs audio
        const audio = new Audio(`data:audio/mpeg;base64,${result.data.audio}`)
        audio.play()
      } else {
        // Fallback to Web Speech API
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.rate = 1.1
        speechSynthesis.speak(utterance)
      }
    } catch (error) {
      // Fallback to Web Speech API
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.1
      speechSynthesis.speak(utterance)
    }
  }, [])

  // Handle proposal confirmation
  const handleConfirmProposal = useCallback(() => {
    if (pendingActions.length > 0) {
      applyActions(pendingActions)
      toast.success('Changes applied')
    }
    setPendingProposal(null)
    setPendingActions([])
  }, [pendingActions, applyActions])

  // Handle proposal cancel
  const handleCancelProposal = useCallback(() => {
    setPendingProposal(null)
    setPendingActions([])
    toast.info('Changes cancelled')
  }, [])

  // Undo/Redo
  const canUndo = historyRef.current.length > 0
  const canRedo = futureRef.current.length > 0

  const handleUndo = useCallback(() => {
    if (canUndo) {
      applyActions([{ action: 'undo' }])
      toast.info('Undone')
    }
  }, [canUndo, applyActions])

  const handleRedo = useCallback(() => {
    if (canRedo) {
      applyActions([{ action: 'redo' }])
      toast.info('Redone')
    }
  }, [canRedo, applyActions])

  // Setup Phase Handlers
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

  const handleStartEvent = () => {
    setState((prev) => ({
      ...prev,
      scoring_mode: scoringMode,
      event_id: `event_${Date.now()}`,
    }))
    setSetupPhase('live')
    toast.success('Event started! Use voice commands to manage.')
  }

  // Render setup screen
  if (setupPhase !== 'live') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl"
        >
          <Card className="border-2">
            <CardHeader className="text-center space-y-2">
              <div className="flex justify-center">
                <div className="flex items-center gap-2 font-bold text-3xl">
                  <Sparkles className="w-8 h-8 text-primary" />
                  <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                    Elixa
                  </span>
                </div>
              </div>
              <CardTitle className="text-2xl">Setup Your Event</CardTitle>
              <CardDescription>
                Describe your game, quiz, or competition in natural language
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Event Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Event Description</label>
                <textarea
                  className="w-full min-h-[200px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Describe your event... For example:&#10;&#10;'A trivia quiz with 5 rounds. Teams earn 10 points for correct answers and lose 5 for wrong ones. Top 3 teams get badges. Teams can freeze opponents or get immunity shields.'"
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                />
              </div>

              {/* Scoring Mode */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Scoring Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={scoringMode === 'numeric' ? 'default' : 'outline'}
                    onClick={() => setScoringMode('numeric')}
                    className="h-auto py-3 flex-col"
                  >
                    <Zap className="w-5 h-5 mb-1" />
                    Numeric
                  </Button>
                  <Button
                    variant={scoringMode === 'goal_based' ? 'default' : 'outline'}
                    onClick={() => setScoringMode('goal_based')}
                    className="h-auto py-3 flex-col"
                  >
                    <Timer className="w-5 h-5 mb-1" />
                    Goal Based
                  </Button>
                  <Button
                    variant={scoringMode === 'pass_fail' ? 'default' : 'outline'}
                    onClick={() => setScoringMode('pass_fail')}
                    className="h-auto py-3 flex-col"
                  >
                    <Users className="w-5 h-5 mb-1" />
                    Pass/Fail
                  </Button>
                </div>
              </div>

              {/* Compiled Rules Preview & Editor */}
              {compiledRules && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Brain className="w-4 h-4 text-primary" />
                      Compiled Rules (Review & Edit)
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCompiledRules(null)}
                    >
                      Clear
                    </Button>
                  </div>
                  <textarea
                    className="w-full min-h-[300px] px-3 py-2 rounded-md border border-input bg-background text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                    value={JSON.stringify(compiledRules, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value)
                        setCompiledRules(parsed)
                      } catch (err) {
                        // Invalid JSON, don't update yet
                      }
                    }}
                  />
                  <div className="text-xs text-muted-foreground">
                    ✓ {compiledRules.triggers?.length || 0} triggers •
                    {compiledRules.statusValues?.length || 0} status values •
                    {compiledRules.tokens?.length || 0} tokens
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
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Compiling Rules...
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4" />
                      Compile Rules with AI
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleStartEvent}
                  disabled={!eventDescription.trim()}
                  className="flex-1"
                >
                  <Play className="w-4 h-4" />
                  Start Event
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                You can start without compiling rules. AI will adapt to your commands in real-time.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 font-bold text-xl">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                Elixa
              </span>
            </div>
            <Badge variant="secondary" className="hidden sm:flex">
              AI-Powered Events
            </Badge>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4" />
              <span>Round {state.round}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              <span>{state.teams.length} teams</span>
            </div>
            <Badge variant="outline" className="capitalize">
              {state.scoring_mode.replace('_', ' ')}
            </Badge>
            {state.sudden_death && (
              <Badge variant="destructive">Late-stage</Badge>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 container grid lg:grid-cols-[1fr_400px] gap-6 p-6">
        {/* Leaderboard */}
        <main>
          <Leaderboard teams={state.teams} />
        </main>

        {/* Operator Console */}
        <aside className="space-y-4">
          {/* Mic Control */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                Operator Console
                <Button variant="ghost" size="icon" className="ml-auto h-8 w-8">
                  <Settings className="w-4 h-4" />
                </Button>
              </CardTitle>
              <CardDescription>
                Voice + text controlled event management
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleTextCommandSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={typedCommand}
                  onChange={(e) => setTypedCommand(e.target.value)}
                  placeholder="Type command (e.g. Team 1 plus 10)"
                  className="flex-1 h-11 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={isProcessing}
                />
                <Button
                  type="submit"
                  className="h-11"
                  disabled={isProcessing || typedCommand.trim().length === 0}
                >
                  Send
                </Button>
              </form>

              {/* Mic Button */}
              <Button
                size="xl"
                variant={isListening ? 'destructive' : 'default'}
                className="w-full"
                onClick={toggleListening}
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
                  className="flex items-center gap-2 text-sm text-success"
                >
                  <motion.span
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="w-2 h-2 rounded-full bg-success"
                  />
                  Listening for commands...
                </motion.div>
              )}

              {/* Undo/Redo */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={!canUndo}
                  onClick={handleUndo}
                >
                  <Undo2 className="w-4 h-4 mr-1" />
                  Undo
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={!canRedo}
                  onClick={handleRedo}
                >
                  <Redo2 className="w-4 h-4 mr-1" />
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
                    <span className="text-sm font-medium">Processing...</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

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

          {/* Transcript */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <Volume2 className="w-4 h-4" />
                Last Transcript
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-mono bg-muted p-3 rounded-lg min-h-[60px]">
                {lastTranscript || 'Waiting for voice input...'}
              </p>
            </CardContent>
          </Card>

          {/* Agent Trace */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <Brain className="w-4 h-4" />
                Agent Reasoning
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs font-mono bg-muted p-3 rounded-lg overflow-auto max-h-[200px] whitespace-pre-wrap">
                {agentTrace || 'No agent activity yet'}
              </pre>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
