/** Elixa — Core Type Definitions */

// ============ Scoring Types ============

export type ScoringType = 'linear' | 'non_linear'
export type ScoringMode = 'numeric' | 'goal_based' | 'pass_fail'
export type EventTemplate = 'QUIZ' | 'LIVE_GAME'
export type EventStatus = 'planning' | 'live' | 'ended'
export type TeamStatus = 'active' | 'frozen' | 'disqualified' | 'eliminated' | 'shielded' | 'cursed'
export type FreezeUntil = 'end_of_round' | 'indefinite' | number
export type RoundStatus = 'pending' | 'active' | 'complete'
export type LiveRoundState = 'not_started' | 'in_progress' | 'completed'
export type TimerState = 'idle' | 'running' | 'paused'
export type ModifierType = 'tiebreak_bonus' | 'sudden_death' | 'custom_bonus'
export type ModifierTarget = 'next_correct_team' | 'specific_team' | 'all_teams'
export type OperatorRole = 'global' | 'checkpoint' | 'team'

// ============ Rule Manifest Types ============

export interface RuleCondition {
  target: 'initiator' | 'receiver' | 'global'
  field: string
  equals?: string | number | boolean
}

export interface RuleAction {
  target: 'initiator' | 'receiver' | 'global'
  field: string
  operation: 'increment' | 'decrement' | 'set' | 'toggle'
  value?: string | number | boolean
}

export interface RuleTrigger {
  phrase: string
  conditions?: RuleCondition[]
  actions: RuleAction[]
  commentary_hint?: string
}

export interface RuleManifest {
  scoringType: ScoringType
  triggers: RuleTrigger[]
  passiveEffects?: Array<{
    condition: RuleCondition
    effect: RuleAction
    timing: 'round_start' | 'round_end' | 'on_score_change'
  }>
  statusValues: string[]
  tokens?: string[]
  modifiers?: string[]
  globalTriggers?: RuleTrigger[]
  chainReactions?: Array<{
    trigger: string
    followUp: RuleAction[]
  }>
  commentary_hints?: Record<string, string>
  rulesetLabel?: string
}

// ============ Team/Participant Types ============

export interface Team {
  id: string
  name: string
  color: string
  score: number
  live_status: TeamStatus
  freeze_until?: FreezeUntil
  avatar_url?: string

  // Token states
  revive_token?: boolean
  shield_token?: boolean
  revive_used?: boolean

  // Timed effects
  shield_rounds_remaining?: number
  cursed_rounds_remaining?: number

  // Buffs
  momentum_buff?: boolean

  // State snapshots
  score_at_defeat?: number

  // Checkpoints (Scenario 2)
  checkpoints_reached?: number[]

  // Metadata
  created_at: number
  updated_at: number
}

// ============ Score Event Types ============

export interface ScoreEvent {
  id: string
  team_id: string
  delta: number
  reason: string
  timestamp: number
  round_number: number
  is_correction?: boolean
  correction_reason?: string
}

// ============ Round Types ============

export interface LiveOverride {
  field: string
  new_value: number | null
  effective_from: number
  reason: string
}

export interface Round {
  round_number: number
  status: RoundStatus
  started_at?: number
  ended_at?: number
  live_overrides?: LiveOverride[]
}

// ============ Modifier Types ============

export interface ActiveModifier {
  id: string
  type: ModifierType
  target: ModifierTarget
  target_team_id?: string
  delta: number
  expires_after: 'one_claim' | 'end_of_round' | 'never'
  claimed?: boolean
  created_at: number
}

// ============ Operator Types ============

export interface Operator {
  code: string
  role: OperatorRole
  scope_id?: string
  name?: string
}

// ============ Announcement Types ============

export interface Announcement {
  id: string
  message: string
  scheduled_at: number
  sent: boolean
  voice: boolean
  created_at: number
}

// ============ Event Config (Full Schema) ============

export interface EventConfig {
  event_id: string
  name: string
  template: EventTemplate
  status: EventStatus

  teams: Team[]
  rules: {
    scoring_events: Array<{ type: string; delta: number }>
    elimination?: { after_round: number; keep_top_n: number }
    tiebreak?: 'solve_time' | 'none'
  }

  rounds: Round[]
  current_round: number

  active_modifiers?: ActiveModifier[]
  operators: Operator[]
  announcements: Announcement[]

  // Scenario 2 only
  rule_manifest?: {
    scoring_type: ScoringType
    manifest_json: string
  }

  entity_states?: Array<{
    team_id: string
    checkpoints_reached: number[]
    status: string
  }>

  // Timer
  timer: {
    state: TimerState
    duration_sec?: number
    ends_at?: number
  }

  // Metadata
  created_at: number
  updated_at: number
}

// ============ Live State (Runtime) ============

export interface LiveState {
  event_id: string
  teams: Team[]
  scoring_mode: ScoringMode
  round: number
  total_rounds: number
  round_state: LiveRoundState
  goal_target?: number
  goal_label?: string
  timer: {
    state: TimerState
    duration_sec?: number
    ends_at?: number
  }
  sudden_death?: boolean
  rule_manifest?: RuleManifest
}

// ============ Voice Action Types ============

export type VoiceAction =
  | { action: 'add_participants'; teams: Array<{ id?: string; name: string; score?: number; color?: string }> }
  | { action: 'add_participants'; count: number }
  | { action: 'update_score'; id: string; delta: number; reason?: string }
  | { action: 'set_score'; id: string; score: number; reason?: string }
  | { action: 'rename_team'; id: string; new_name: string }
  | { action: 'timer'; state: 'start' | 'stop' | 'pause' | 'reset'; duration?: number }
  | { action: 'change_mode'; mode: ScoringMode; target?: number; label?: string }
  | { action: 'start_round'; round: number }
  | { action: 'end_round' }
  | { action: 'set_total_rounds'; total_rounds: number }
  | { action: 'freeze_team'; id: string; until?: FreezeUntil }
  | { action: 'thaw_team'; id: string }
  | { action: 'eliminate_team'; id: string }
  | { action: 'disqualify_team'; id: string }
  | { action: 'revive_team'; id: string }
  | { action: 'apply_rule_mutation'; target_id: string; field: string; operation: RuleAction['operation']; value?: unknown }
  | { action: 'set_team_field'; id: string; field: string; value: unknown }
  | { action: 'set_global_field'; field: string; value: unknown }
  | { action: 'add_modifier'; modifier: Omit<ActiveModifier, 'id' | 'created_at'> }
  | { action: 'claim_modifier'; modifier_id: string; team_id: string }
  | { action: 'create_announcement'; message: string; voice?: boolean }
  | { action: 'record_checkpoint'; team_id: string; checkpoint: number }
  | { action: 'undo' }
  | { action: 'redo' }
  | { action: 'manual_correction'; team_id: string; new_score: number; reason: string }

// ============ Agent Types ============

export interface AgentProposal {
  type: 'proposal' | 'question' | 'explanation'
  confirmation_title: string
  changes: string[]
  untouched: string[]
  effective_from: string
  action: {
    reducer: string
    params: Record<string, unknown>
  }
  message?: string
}

export interface AgentResponse {
  thought?: string
  observation?: string
  actions: VoiceAction[]
  commentary?: string
  proposal?: AgentProposal
}

// ============ Pattern Match Types ============

export interface PatternMatch {
  matched: true
  actions: VoiceAction[]
  commentary?: string
}

export interface PatternNoMatch {
  matched: false
}

export type PatternResult = PatternMatch | PatternNoMatch

// ============ API Response Types ============

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface CompileRulesResponse {
  manifest: RuleManifest
}

export interface SetupEventResponse {
  config: EventConfig
}

export interface AgentCallResponse {
  response: AgentResponse
}

export interface SummaryResponse {
  summary: string
  highlights: string[]
  statistics: Record<string, number>
}

// ============ Event Orchestration Types ============

export type OrchestrationPhaseId = 'permissions' | 'venue' | 'sponsors' | 'registrations' | 'volunteers' | 'gonogo'
export type OrchestrationTaskStatus = 'locked' | 'available' | 'in_progress' | 'completed' | 'blocked'
export type OrchestrationTaskPriority = 'critical' | 'high' | 'medium' | 'low'
export type OrchestrationCheckpointStatus = 'locked' | 'available' | 'passed' | 'failed'
export type OrchestrationOperatorRole = 'director' | 'venue_lead' | 'sponsor_lead' | 'tech_lead' | 'volunteer_coord' | 'volunteer'
export type OrchestrationEventStatus = 'planning' | 'active' | 'completed'

export interface OrchestrationTask {
  task_id: string
  event_id: string
  title: string
  description: string
  phase: OrchestrationPhaseId
  status: OrchestrationTaskStatus
  assigned_role: OrchestrationOperatorRole
  assigned_to?: string // specific operator_id
  depends_on: string[] // task_ids
  deadline?: number // unix timestamp
  priority: OrchestrationTaskPriority
  completed_at?: number
  completed_by?: string // operator_id
  notes?: string
  created_at: number
}

export interface OrchestrationPhase {
  id: OrchestrationPhaseId
  label: string
  tasks: OrchestrationTask[]
}

export interface OrchestrationOperator {
  operator_id: string // e.g., "OP-VEN-4A2B" or "DIR-XXXX"
  event_id: string
  role: OrchestrationOperatorRole
  label: string // human-readable, e.g., "Venue Lead"
  scope: OrchestrationPhaseId[] // phases this operator can update
  name?: string
  last_active?: number
}

export interface OrchestrationCheckpoint {
  checkpoint_id: string
  event_id: string
  phase: OrchestrationPhaseId
  name: string // e.g., "Venue Confirmed"
  status: OrchestrationCheckpointStatus
  required_task_ids: string[]
  passed_at?: number
  passed_by?: string // director operator_id
}

export interface OrchestrationEvent {
  event_id: string
  name: string
  description: string
  date: number // unix timestamp
  venue: string
  participant_count: number
  status: OrchestrationEventStatus
  created_at: number
  updated_at: number
  director_id: string
  tasks: OrchestrationTask[]
  operators: OrchestrationOperator[]
  checkpoints: OrchestrationCheckpoint[]
}

// AI-generated config (before commit)
export interface OrchestrationEventConfigInput {
  name: string
  date: string // ISO8601
  venue: string
  participant_count: number
  phases: Array<{
    id: OrchestrationPhaseId
    label: string
    tasks: Array<{
      title: string
      description: string
      assigned_role: string
      priority: OrchestrationTaskPriority
      deadline: string // ISO8601
      depends_on_titles: string[] // resolved to IDs at commit time
    }>
  }>
  roles: Array<{
    role: OrchestrationOperatorRole
    label: string
    scope: OrchestrationPhaseId[]
  }>
}

export interface OrchestrationTaskHistoryEntry {
  task_id: string
  event_id: string
  from_status: OrchestrationTaskStatus
  to_status: OrchestrationTaskStatus
  changed_by: string // operator_id
  timestamp: number
  notes?: string
}

export interface OrchestrationSession {
  operator_id: string
  event_id: string
  role: OrchestrationOperatorRole
  scope: OrchestrationPhaseId[]
  label: string
}
