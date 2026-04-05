# ⚡ ELIXA — Pre-Event Orchestration Platform

_Describe your event. Watch it come alive._

**HackByte 4.0 | PDPM IIITDM Jabalpur | MLH Official 2026 Season**

---

## What It Does

**Primary: Pre-Event Orchestration** — An AI-powered task management system for event organizers. Describe your hackathon, fest, or event in plain language → master AI agent generates a complete phase-based task structure with roles, dependencies, and checkpoints → real-time coordination across your entire organizing team → Go/No-Go launch readiness confirmation.

Replaces: WhatsApp coordination groups, scattered Excel sheets, verbal check-ins, and manual task tracking.

**Secondary: Live Event Management** — Real-time scoreboard and game execution for quizzes, treasure hunts, and campus quests during the event. Voice-controlled scoring, live leaderboards, AI-assisted rule enforcement.

---

## The Core Problem — Pre-Event Chaos

Before any hackathon or college fest begins, organizing teams face 30-60 critical tasks:
- Institute permissions and administrative approvals
- Venue booking and logistics coordination
- Sponsor outreach, follow-ups, and confirmations
- Participant registration and team management
- Volunteer briefing and role assignment
- Infrastructure setup (WiFi, power, equipment)
- Final Go/No-Go review before doors open

**Current Reality:** One person holds all context. Coordination happens over WhatsApp. Tasks fall through the cracks. No single source of truth visible to everyone simultaneously.

**Elixa's Solution:** The Checklist-to-Checkpoint Pipeline — AI-generated, phase-based pre-event task management with real-time updates, role-based access, and dependency-locked progression.

---

## Event Orchestration Workflow

### The Six-Phase Pipeline

| **Phase** | **What Happens** | **Who Owns It** | **Checkpoint** |
|---|---|---|---|
| 1. Permissions | Institute NOC, admin approvals, date confirmation, insurance | Director | All critical approvals secured |
| 2. Venue | Hall booking, AV equipment, seating layout, power backup | Venue Lead | Venue confirmed and ready |
| 3. Sponsors | Sponsorship deck, outreach, follow-ups, commitment confirmations | Sponsor Lead | Minimum sponsor threshold met |
| 4. Registrations | DevFolio setup, registration link distribution, team shortlisting | Tech Lead | Registration count target reached |
| 5. Volunteers | Volunteer briefing, role assignment, T-shirt confirmation, schedules | Volunteer Coordinator | All volunteers briefed and assigned |
| 6. Go/No-Go | Final checklist review, contingency plans, event readiness declaration | Director | Director passes final checkpoint |

### How It Works

**Step 1: Describe Your Event**
```
Manager: "HackByte 4.0, 24-hour hackathon, 200 participants,
IIITDM Jabalpur, April 20. 5 volunteers. Need permissions,
venue, sponsors, registrations sorted."
```

**Step 2: AI Generates Complete Structure**
- Master agent (Gemini 2.5 Flash) parses description
- Generates 30-60 tasks across 6 phases
- Creates role-based access codes (Director, Venue Lead, Sponsor Lead, etc.)
- Builds dependency chains (e.g., "Arrange seating" unlocks after "Confirm venue booking")
- Sets realistic deadlines relative to event date
- Creates phase checkpoints with unlock conditions

**Step 3: Real-Time Coordination Begins**
- Director shares role codes with team members
- Venue Lead logs in → sees only venue tasks
- Sponsor Lead logs in → sees only sponsor tasks
- Any task marked complete → all clients update instantly (<300ms via SpacetimeDB)
- Dependent tasks unlock automatically when prerequisites complete
- Progress visible to entire team simultaneously

**Step 4: Go/No-Go Launch Confirmation**
- All critical tasks across all phases complete
- Director reviews final checkpoint
- Director clicks "Pass Go/No-Go"
- ElevenLabs voice: _"All systems confirmed. HackByte 4.0 is ready to launch."_
- Event enters live phase

---

## Live Event Management (Secondary Feature)

Once the event launches, Elixa transitions to live event management mode for running quizzes and games.

### Quiz Mode
Round-based scoring, elimination rules, live leaderboard. Manager and operators score teams via voice or tap interface.

### Game Mode (Treasure Hunt / Campus Quest)
Checkpoint-based games described in plain language. AI compiles rules into a Rule Manifest. Checkpoint marshals mark team arrivals via voice. Non-linear scoring triggers, first-arrival bonuses, status effects.

---

## Architecture — Pre-Event Orchestration

### System Layers

| **Layer** | **Technology** | **Role** |
|---|---|---|
| Frontend | Next.js 14 (App Router) | Manager dashboard, volunteer view, agent chat UI |
| Real-Time State | SpacetimeDB | Live task status sync across all users (<300ms) |
| Persistence | MongoDB Atlas | Event history, agent logs, task audit trail |
| AI Agent | Gemini 2.5 Flash | Parse event description → generate task structure |
| Styling | Tailwind CSS v3 + shadcn/ui | Component library, dark theme |
| Animation | Framer Motion | Task completion animations, progress transitions |
| Voice | ElevenLabs Turbo v2 | Announcements, checkpoint narration |
| Auth | iron-session | Role-based access via signed cookies |
| Icons | Lucide React | Consistent icon set |
| Toasts | Sonner | Action feedback notifications |

**⚠ Use Tailwind CSS v3 — NOT v4. shadcn/ui compatibility.**

### Request Flow — Manager Creates Event

```
Manager types description in plain English
    ↓
POST /api/plan → Gemini parses → streams EventConfig JSON
    ↓
Manager reviews preview card
    ↓
POST /api/commit → EventConfig committed to SpacetimeDB
    ↓
Agent auto-generates tasks, roles, dependencies, checkpoints
    ↓
Role codes generated and displayed
    ↓
Volunteers log in with codes → see scoped task views
    ↓
Task marked complete → SpacetimeDB subscription fires → all clients update <300ms
```

**⚠ CRITICAL:** `/api/plan` only streams text. `/api/commit` only writes to DB. Never merge these routes — combining streaming with DB writes breaks the stream.

### Request Flow — Volunteer Marks Task Complete

```
Volunteer taps 'Mark Complete'
    ↓
Optimistic UI update (instant local green)
    ↓
POST /api/action → SpacetimeDB reducer: complete_task(task_id, operator_id)
    ↓
Reducer checks: operator authorized for this task?
    ↓
YES → task.status = 'complete', timestamp recorded
    ↓
Check dependent tasks → unlock if prerequisites met
    ↓
SpacetimeDB subscription fires to all clients
    ↓
Manager dashboard: task green, progress bar advances
    ↓
If reducer fails → revert optimistic update, show error toast
    ↓
Async: MongoDB write to task_history
```

### Database Design — Pre-Event Tables

**SpacetimeDB Tables (Live State)**

**events** — Event metadata and status
- event_id (UUID), name, description, date, venue, participant_count
- status: `planning | active | completed`
- director_id, created_at

**tasks** — Individual tasks with dependencies
- task_id (UUID), event_id, title, description
- phase: `permissions | venue | sponsors | registrations | volunteers | gonogo`
- status: `locked | available | in_progress | completed | blocked`
- assigned_role, assigned_to, depends_on (Vec<task_id>)
- priority: `critical | high | medium | low`
- deadline, completed_at, completed_by, notes

**⚠ CRITICAL:** AI returns `depends_on_titles` as strings. Must resolve titles → task_ids in two-pass before commit. See eventorch.md Section 4.4.

**operators** — Role-based access codes
- operator_id (access code: OP-VEN-4A2B), event_id
- role: `director | venue_lead | sponsor_lead | tech_lead | volunteer_coord | volunteer`
- label, scope (phases this operator can update)
- name, last_active

**checkpoints** — Phase completion gates
- checkpoint_id, event_id, phase, name
- status: `locked | available | passed | failed`
- required_task_ids, passed_at, passed_by

**announcements** — Real-time notifications
- announcement_id, event_id, message
- scheduled_at, sent, voice, created_by

**MongoDB Collections (History & Audit)**
- `events_archive` — Completed events
- `task_history` — Audit trail of all task state changes
- `agent_conv_log` — Planning conversation history
- `override_log` — Director manual overrides
- `announcement_log` — All sent announcements

### Role-Based Access Control

| **Role** | **Access Code** | **Scope** | **Permissions** |
|---|---|---|---|
| Director | DIR-XXXX | All phases | Create event, pass checkpoints, override, announce |
| Venue Lead | OP-VEN-XXXX | Venue phase only | Mark venue tasks complete, add notes, flag blockers |
| Sponsor Lead | OP-SPO-XXXX | Sponsors phase only | Mark sponsor tasks complete, log confirmations |
| Tech Lead | OP-TEC-XXXX | Registrations phase | Mark tech tasks complete |
| Volunteer Coordinator | OP-VOL-XXXX | Volunteers phase | Mark tasks complete, assign sub-volunteers |
| Volunteer | OP-V-XXXX | Specific assigned tasks | Mark own tasks complete, add notes |

**Access Flow:**
1. User enters access code
2. POST /api/auth → SpacetimeDB query: find operator by code
3. iron-session cookie issued: `{ operator_id, role, scope, event_id }`
4. Redirect to role-appropriate dashboard
5. SpacetimeDB subscription filtered to operator's scope

---

## Architecture — Live Event Management

### Tech Stack Extensions

| Layer | Tool |
|---|---|
| Layout Animation | Framer Motion v11 |
| Number Animation | React Spring v9 |
| Confetti | canvas-confetti |
| Sound | Howler.js |
| AI — Rule Manifest | Claude Sonnet 4 |
| Voice Input | Web Speech API (native) |
| Avatar Generation | DiceBear v7 |

---

## AI Integration — Two Modes, Three Calls

### Pre-Event Mode (Primary)

**AI Call #1: Event Setup — Master Agent Planning**

Manager describes event in plain language → Gemini 2.5 Flash extracts full `EventConfig`:
- Event metadata (name, date, venue, participant count)
- 6 phases with 30-60 tasks
- Role structure and access codes
- Task dependencies and deadlines
- Phase checkpoints and unlock conditions

One call per event at creation. Temperature: 0.2 for consistent JSON output.

**System Prompt:**
```
You are Elixa's event planning agent. Parse plain English event
descriptions into structured EventConfig JSON.

RULES:
1. Ask max 2 clarifying questions if critical info missing
2. Never guess volunteer count - always ask
3. Generate realistic deadlines relative to event date
4. Always generate Go/No-Go phase as final checkpoint
5. Assign every task to a role - never leave assigned_role empty
6. Output ONLY valid JSON - no markdown, no preamble

OUTPUT SCHEMA:
{
  "name": string,
  "date": ISO8601,
  "venue": string,
  "participant_count": number,
  "phases": [
    {
      "id": "permissions|venue|sponsors|registrations|volunteers|gonogo",
      "label": string,
      "tasks": [
        {
          "title": string,
          "description": string,
          "assigned_role": string,
          "priority": "critical|high|medium|low",
          "deadline": ISO8601,
          "depends_on_titles": string[]
        }
      ]
    }
  ],
  "roles": [
    { "role": string, "label": string, "scope": string[] }
  ]
}
```

**⚠ CRITICAL:** Gemini returns `depends_on_titles` as task title strings. SpacetimeDB needs `task_ids`. Must resolve in two-pass:

```javascript
// lib/commitEventConfig.ts
export async function commitEventConfig(config: EventConfig) {
  // 1. Create event record
  await conn.call('create_event', { name, date, venue, participant_count })

  // 2. Create operator codes
  for (const role of config.roles) {
    await conn.call('create_operator', { role, label, scope })
  }

  // 3. FIRST PASS - generate all task IDs, build title→id map
  const titleToId: Record<string, string> = {}
  const stagedTasks: any[] = []

  for (const phase of config.phases) {
    for (const task of phase.tasks) {
      const id = generateUUID()
      titleToId[task.title] = id
      stagedTasks.push({ ...task, task_id: id, phase: phase.id, depends_on: [] })
    }
  }

  // 4. SECOND PASS - resolve depends_on_titles to task_ids
  for (const task of stagedTasks) {
    task.depends_on = (task.depends_on_titles ?? [])
      .map((title: string) => titleToId[title])
      .filter(Boolean)
  }

  // 5. Batch write resolved tasks
  await conn.call('create_tasks_batch', { tasks: stagedTasks })

  // 6. Create phase checkpoints
  await conn.call('create_checkpoints', { phases: config.phases })
}
```

### Live Event Mode (Secondary)

**AI Call #2: Mid-Event Agent**

During live events (quizzes/games), when manager sends a command the pattern matcher can't handle:
- Manager: _"Freeze Team Alpha until end of round 3, they were caught discussing answers"_
- Gemini receives: full EventConfig + live state + conversation history
- Returns: proposal JSON with confirmation details
- Manager confirms → reducer fires
- **Forward-only by default** — past data never touched unless explicit correction with stated reason

**AI Call #3: Rule Manifest Compilation (Game Mode Only)**

For non-linear games (treasure hunts), one pre-session call:
- Plain language game description → Claude Sonnet 4 compiles structured JSON Rule Manifest
- Defines: scoring triggers, status effects, chain reactions, modifiers
- Stored in `EventConfig.rule_manifest`
- Pattern matcher uses manifest at runtime for scoring

**AI Call #4: Post-Event Summary**

Gemini reads score history + override log from MongoDB → narrative summary of event.

---

## Live Event — Command Routing & Scoring

*This section applies to live quiz/game execution mode only.*

### Command Pattern Matcher

```
INPUT RECEIVED (voice or typed during live event)
        ↓
Run against pattern registry
        ↓
MATCH?
  YES → fire SpacetimeDB reducer directly (<50ms, no LLM)
  NO  → send to Gemini with full context
          → Gemini returns proposal JSON
          → show ConfirmationCard to manager
          → manager confirms or cancels
          → if confirmed: fire reducer
```

**Pattern Registry:**
```
"team {name} correct"            → add_score(team, +correct_delta)
"team {name} wrong"              → add_score(team, -wrong_delta)
"team {name} plus {n}"           → add_score(team, +n)
"team {name} minus {n}"          → add_score(team, -n)
"{name} reached checkpoint {n}"  → record_arrival(team, checkpoint)
"start round {n}"                → start_round(n)
"end round {n}"                  → end_round(n)
"eliminate {name}"               → eliminate_team(team)
"undo last action"               → reverse_last_score_event()
"undo last {n} actions"          → reverse_n_score_events(n)
"unfreeze {team}"                → thaw_team(team)
"start timer {n} minutes"        → start_timer(n*60)
"pause timer"                    → pause_timer()
"announce {message}"             → create_announcement(message, now)
"disqualify {team}"              → disqualify_team(team)
anything else                    → Gemini (mid-event agent)
```

### Mid-Event Agent Rules

- **Forward-only by default.** Every change applies from now onward. Past rounds immutable.
- **Confirm before execute.** Agent never changes state silently. Always shows ConfirmationCard.
- **Explicit corrections only.** Touching past scores requires stated reason, logged permanently.

**Agent Proposal Format:**
```json
{
  "type": "proposal | question | explanation",
  "confirmation_title": "string",
  "changes": ["string"],
  "untouched": ["string"],
  "effective_from": "string",
  "action": { "reducer": "...", "params": {} },
  "message": "string"
}
```

### Freeze Logic (Quiz/Game Mode)

Frozen teams receive delta = 0 for every scoring event during freeze window. Score not deducted — they gain nothing. Every blocked event logged as `frozen_noop`.

```rust
pub fn apply_score_delta(ctx: &ReducerContext, team: &mut Team, delta: i32, reason: &str) {
    if team.freeze_status == FreezeStatus::Frozen {
        ScoreEvent::insert(ScoreEvent {
            team_id: team.id.clone(),
            delta: 0,
            reason: format!("[FROZEN] {}", reason),
            timestamp: ctx.timestamp,
        });
        return;
    }
    team.score += delta;
    ScoreEvent::insert(ScoreEvent {
        team_id: team.id.clone(),
        delta,
        reason: reason.to_string(),
        timestamp: ctx.timestamp,
    });
}
```

### Rule Override Logic (Quiz/Game Mode)

Overrides stored separately in `rule_overrides`. Original `EventConfig` never mutated. At scoring time, overrides applied on top.

```rust
reducer override_round_rule(
    event_id: String,
    round_number: u32,
    field: RuleField,       // correct_delta | wrong_delta | elimination
    new_value: Option<i32>,
    effective_from: Timestamp,
)
```

Scope: single round, or forward from timestamp. Never retroactive.

### Rule Manifest Compilation (Game Mode)

```javascript
async function compileRuleManifest(description) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: `You are a game rules compiler. Extract strict JSON Rule Manifest.
Define: scoringType, triggers (phrase, conditions, actions), passiveEffects,
statusValues, tokens, modifiers, globalTriggers, chainReactions.
Output ONLY valid JSON.`,
      messages: [{ role: "user", content: description }]
    })
  });
  const data = await response.json();
  return JSON.parse(data.content[0].text);
}
```

When `scoringType` is `non_linear`, pattern matcher runs commands against manifest trigger phrases instead of static registry.

---

## SpacetimeDB Reducers

### Pre-Event Orchestration Reducers
```
create_event                  // Initialize event from EventConfig
create_tasks_batch           // Batch create all tasks with resolved dependencies
create_operator              // Generate role-based access code
create_checkpoints           // Create phase checkpoints
complete_task                // Mark task complete, unlock dependents, check checkpoint
flag_task_blocked            // Volunteer flags blocker, notifies director
add_task_note               // Add notes to task
pass_checkpoint             // Director passes phase checkpoint
fail_checkpoint             // Director fails checkpoint (rare)
check_and_unlock_dependents // Auto-unlock tasks when dependencies met
check_checkpoint_readiness  // Auto-check if checkpoint can be passed
create_announcement         // Create announcement (text/voice)
send_announcement           // Deliver announcement to all operators
```

### Live Event Reducers (Quiz/Game Mode)
```
add_score_event             // Checks freeze_status before applying delta
reverse_score_event         // Undo last score change
reverse_n_score_events      // Undo last n changes
start_round                 // Begin round, unlock round-specific tasks
end_round                   // End round, apply elimination if configured
freeze_team                 // Set freeze_status + freeze_until condition
thaw_team                   // Remove freeze
override_round_rule         // Forward-only rule patch
manual_score_correction     // Requires reason string, always logged
add_one_time_modifier       // Tiebreak bonus, sudden death, custom bonus
claim_modifier              // Expires modifier after one use
record_checkpoint_arrival   // First-arrival bonus logic (game mode)
eliminate_team              // Remove team from active competition
disqualify_team             // Disqualify with reason logged
```

---

## Data Flow Diagrams

### Pre-Event: Task Completion Flow

```
Volunteer marks task complete (optimistic UI update)
    → POST /api/action → SpacetimeDB reducer: complete_task()
    → Reducer checks: operator scoped to this task?
    → YES → task.status = 'complete', timestamp recorded
    → Check dependent tasks → unlock if prerequisites met
    → Check checkpoint readiness → notify if phase ready
    → SpacetimeDB subscription fires to all clients (<300ms)
    → Manager dashboard: task green, progress bar advances
    → Volunteer view: dependent tasks unlock
    → If reducer fails → revert optimistic update, show error toast
    → Async: MongoDB write to task_history collection
```

### Live Event: Score Update Flow (Routine)

```
Voice/text input during quiz/game
    → Pattern matcher: match found
    → SpacetimeDB reducer (freeze check → apply delta)
    → All clients update via subscription (<300ms)
    → Framer Motion rank reorder
    → React Spring score counter roll
    → Howler.js sound
    → ElevenLabs confirmation (async)
    → MongoDB write (async)
```

### Live Event: Mid-Event Agent Call

```
Voice/text input (unrecognized command)
    → Pattern matcher: no match
    → POST /api/agent
        receives: EventConfig + live state + conversation history + message
    → Gemini returns proposal JSON
    → ConfirmationCard shown to manager
    → Manager confirms
    → POST /api/action → SpacetimeDB reducer
    → All clients update
    → MongoDB logs: change + agent conversation excerpt + timestamp
```

---

## EventConfig Schema

### Pre-Event Mode Fields

```typescript
interface EventConfig {
  // Core event metadata
  event_id:   string;
  name:       string;
  description: string;  // Original natural language input
  date:       number;   // Unix timestamp
  venue:      string;
  participant_count: number;
  mode:       "PRE_EVENT" | "LIVE_QUIZ" | "LIVE_GAME";
  status:     "planning" | "live" | "ended";
  director_id: string;

  // Phase-based task structure (pre-event mode)
  phases?: {
    id:      "permissions" | "venue" | "sponsors" | "registrations" | "volunteers" | "gonogo";
    label:   string;
    tasks:   Task[];
    checkpoint: {
      status:            "locked" | "available" | "passed" | "failed";
      required_task_ids: string[];
      passed_at?:        number;
      passed_by?:        string;
    };
  }[];

  // Operators and roles
  operators: {
    code:      string;  // e.g., OP-VEN-4A2B
    role:      "director" | "venue_lead" | "sponsor_lead" | "tech_lead" | "volunteer_coord" | "volunteer";
    label:     string;
    scope:     string[]; // Phases this operator can access
    name?:     string;
  }[];

  // Announcements
  announcements: {
    id:           string;
    message:      string;
    scheduled_at: number;
    sent:         boolean;
    voice:        boolean;
    created_by:   string;
  }[];
}

interface Task {
  task_id:      string;
  title:        string;
  description:  string;
  phase:        string;
  status:       "locked" | "available" | "in_progress" | "completed" | "blocked";
  assigned_role: string;
  assigned_to?:  string;
  depends_on:    string[];  // Resolved task_ids
  deadline?:     number;
  priority:      "critical" | "high" | "medium" | "low";
  completed_at?: number;
  completed_by?: string;
  notes?:        string;
}
```

### Live Event Mode Extensions

```typescript
interface LiveEventConfig extends EventConfig {
  mode: "LIVE_QUIZ" | "LIVE_GAME";

  // Team structure (quiz/game mode)
  teams: {
    id:           string;
    name:         string;
    color:        string;
    live_status:  "active" | "frozen" | "disqualified" | "eliminated";
    freeze_until?: "end_of_round" | "indefinite" | number;
    score:        number;
  }[];

  // Scoring rules (quiz mode)
  rules: {
    scoring_events: { type: string; delta: number }[];
    elimination?:   { after_round: number; keep_top_n: number };
    tiebreak?:      "solve_time" | "none";
  };

  // Rounds (quiz mode)
  rounds: {
    round_number: number;
    status:       "pending" | "active" | "complete";
    live_overrides?: {
      field:          string;
      new_value:      number | null;
      effective_from: number;
      reason:         string;
    }[];
  }[];

  // Active modifiers (quiz/game mode)
  active_modifiers?: {
    type:          "tiebreak_bonus" | "sudden_death" | "custom_bonus";
    target:        "next_correct_team" | "specific_team" | "all_teams";
    delta:         number;
    expires_after: "one_claim" | "end_of_round" | "never";
  }[];

  // Game-specific fields (game mode only)
  rule_manifest?: {
    scoring_type:  "linear" | "non_linear";
    manifest_json: string;
  };

  entity_states?: {
    team_id:             string;
    checkpoints_reached: number[];
    status:              string;
  }[];
}
```

---

## Frontend Architecture

### Three Core Screens (Pre-Event Mode)

**⚠ Build exactly these three screens. Delete anything beyond these.**

**Screen 1 — Manager Setup Chat** (`/`)

- Text input for event description in plain language
- Streaming Gemini response via Vercel AI SDK `useChat` hook
- EventConfig preview card shown before commit — manager reviews tasks, phases, role codes
- 'Launch Event' button → POST /api/commit → redirects to `/dashboard/[event_id]`
- Confirmation screen: generated operator codes with copy buttons

**Screen 2 — Manager Dashboard** (`/dashboard/[event_id]`)

- Phase cards arranged horizontally: Permissions → Venue → Sponsors → Registrations → Volunteers → Go/No-Go
- Each phase shows: task count, completion count, progress bar, checkpoint status
- Click phase to expand → see all tasks with status indicators
- Live completion percentage in top right — updates instantly via SpacetimeDB subscription
- 'Pass Checkpoint' button appears when all critical tasks in phase complete
- Operator activity feed on right — who did what, when
- Announcement composer at bottom

**Screen 3 — Volunteer Task View** (`/volunteer/[event_id]`)

- Clean task list filtered to operator's scope only — nothing else visible
- Available tasks: green border, 'Mark Complete' button active
- Locked tasks: gray, shows what needs to complete first
- Completed tasks: checkmark, completion timestamp, non-interactive
- 'Flag Blocker' button on any task — notifies director instantly
- Notes field on each task — visible to director on dashboard

### Additional Screens (Live Event Mode)

**Screen 4 — Live Scoreboard** (`/live/[event_id]`)

- Real-time leaderboard with animated rank changes
- Score counter animations with React Spring
- Team status indicators (active, frozen, eliminated)
- Round timer and announcements

**Screen 5 — Game Control Panel** (`/control/[event_id]`)

- Voice/text input for scoring commands
- ConfirmationCard for agent proposals
- Round controls, timer controls
- Override and modifier management

---

### Key UI Components

| **Component** | **File** | **Purpose** |
|---|---|---|
| **Pre-Event Components** |||
| PlanningChat | components/PlanningChat.tsx | Agent chat interface with streaming Gemini response |
| EventConfigPreview | components/EventConfigPreview.tsx | Shows generated task structure before committing |
| PhaseBoard | components/PhaseBoard.tsx | Horizontal phase cards on manager dashboard |
| TaskCard | components/TaskCard.tsx | Individual task with status, notes, complete button |
| CheckpointBadge | components/CheckpointBadge.tsx | Visual indicator of phase checkpoint status |
| ProgressRing | components/ProgressRing.tsx | Animated circular progress for overall completion |
| OperatorFeed | components/OperatorFeed.tsx | Live activity feed of who did what |
| AnnouncementBar | components/AnnouncementBar.tsx | Compose and send announcements |
| **Live Event Components** |||
| ScoreboardCard | components/ScoreboardCard.tsx | Animated team card with score and rank |
| ConfirmationCard | components/ConfirmationCard.tsx | Agent proposal confirmation UI |
| VoiceInput | components/VoiceInput.tsx | Web Speech API voice command interface |
| RoundTimer | components/RoundTimer.tsx | Countdown timer with pause/resume |
| TeamStatusBadge | components/TeamStatusBadge.tsx | Active/frozen/eliminated indicators |

### Design System Tokens

Define once in `globals.css` — never hardcode colors in components.

```css
/* globals.css */
:root {
  --color-bg: #0A0A0F;
  --color-surface: #13131A;
  --color-border: #1E1E2E;
  --color-primary: #6C63FF;    /* purple - CTAs */
  --color-accent: #00D4FF;     /* cyan - live indicators */
  --color-success: #00E676;    /* task complete / correct answer */
  --color-warning: #FFD600;    /* blocker flagged */
  --color-danger: #FF1744;     /* checkpoint failed / wrong answer */
  --color-text-primary: #F0F0FF;
  --color-text-muted: #8888AA;
  --font-heading: 'Clash Display', sans-serif;
  --font-body: 'DM Sans', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

---

## Animation System

### Pre-Event Mode Animations

| Event | Library | Behavior |
|---|---|---|
| Task completion | Framer Motion | Card fade effect, checkmark scale-in |
| Progress bar | Framer Motion | Smooth width transition with spring |
| Checkpoint unlock | Framer Motion | Badge pulse, color shift green |
| Phase expand/collapse | Framer Motion | Height animation with ease-out |
| Operator activity | Framer Motion | Feed items slide in from right |
| Go/No-Go pass | canvas-confetti + sound | Confetti burst + success chime |

### Live Event Mode Animations

| Event | Library | Behavior |
|---|---|---|
| Score update | React Spring | Counter rolls to new value |
| Rank change | Framer Motion `layoutId` | Card moves to new position (spring) |
| Score delta | CSS + Framer | +10 pill fades in, then out over 2s |
| Freeze applied | Framer `animate` | Card opacity → 0.6, ❄️ badge mounts |
| Thaw | Framer `animate` | Card opacity → 1.0, ❄️ badge dissolves |
| Elimination | Framer `exit` | Card slides left with red overlay |
| First place | canvas-confetti | Burst on rank-1 takeover |
| Round start | Framer | Full-screen banner, then dismisses |

**ElevenLabs narration** fires inside `onLayoutAnimationComplete` — audio plays when card settles, not before.

---

## API Routes

### Pre-Event Routes

| **Method + Path** | **Auth Required** | **What it Does** |
|---|---|---|
| POST /api/plan | None | Streams Gemini response for event planning. Does NOT write to DB. |
| POST /api/commit | Director session | Commits EventConfig to SpacetimeDB. Separate from /api/plan. |
| POST /api/auth | None | Validates access code, returns iron-session cookie |
| POST /api/action | Any operator | Routes operator action to SpacetimeDB reducer |
| POST /api/announce | Director | Creates announcement, optionally triggers ElevenLabs voice |
| POST /api/checkpoint | Director | Director passes or fails a phase checkpoint |
| GET /api/event/[id] | Any operator | Returns current event state snapshot |
| GET /api/tasks/[event_id] | Any operator | Returns tasks filtered to operator scope |
| POST /api/flag | Any operator | Flags task as blocked, notifies director |

### Live Event Routes

| **Method + Path** | **Auth Required** | **What it Does** |
|---|---|---|
| POST /api/agent | Manager | Mid-event agent call with full context |
| POST /api/score | Operator | Apply score delta (pattern-matched or manual) |
| POST /api/round | Manager | Start/end round, apply elimination rules |
| POST /api/freeze | Manager | Freeze/thaw team |
| POST /api/override | Manager | Apply forward-only rule override |
| GET /api/leaderboard/[id] | Public | Returns current leaderboard state |

### Core Reducer Route Pattern

All operator actions funnel through `/api/action`:

```typescript
// app/api/action/route.ts
const PATTERN_MAP: Record<string, string> = {
  // Pre-event patterns
  complete_task: 'complete_task',
  flag_blocker: 'flag_task_blocked',
  add_note: 'add_task_note',
  pass_checkpoint: 'pass_checkpoint',
  fail_checkpoint: 'fail_checkpoint',
  // Live event patterns
  add_score: 'add_score_event',
  freeze_team: 'freeze_team',
  thaw_team: 'thaw_team',
  eliminate_team: 'eliminate_team',
}

export async function POST(req: Request) {
  const { action_type, payload } = await req.json()
  const session = await getSession(req)

  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const reducer = PATTERN_MAP[action_type]
  if (!reducer) return Response.json({ error: 'Unknown action' }, { status: 400 })

  await spacetimeDB.call(reducer, { ...payload, operator_id: session.operator_id })

  return Response.json({ success: true })
}
```

---

## Undo System

### Pre-Event Mode

Tasks can be unmarked as complete (reverted to previous status) through director override. All state changes logged in `task_history` for full audit trail.

```javascript
// Pre-event undo via director dashboard
function undoTaskCompletion(taskId: string) {
  dispatch({ type: 'TASK_REVERT_OPTIMISTIC', taskId })

  callReducer('revert_task_completion', {
    task_id: taskId,
    director_id: session.director_id,
    reason: 'Accidentally marked complete'
  })
  .catch(() => {
    dispatch({ type: 'TASK_COMPLETE_RESTORE', taskId })
    toast.error('Could not revert task - please try again')
  })
}
```

### Live Event Mode (Command Pattern)

```javascript
function handleAction(payload) {
  const inverse = computeInverse(payload);
  dispatch(payload);           // optimistic local update
  historyStack.push(inverse);
  persistToSpacetimeDB(payload).catch(err => retryQueue.push(payload));
}

function undo() {
  const inverse = historyStack.pop();
  dispatch(inverse);
}
```

Agent-proposed changes (freezes, overrides) not in undo stack. Reversed through new agent interaction and logged.

---

## Environment Variables

```bash
# .env.local

# AI Services
GOOGLE_GENERATIVE_AI_API_KEY=    # Gemini - Google AI Studio (planning agent)
ANTHROPIC_API_KEY=                # Claude - Anthropic (rule manifest compiler)
ELEVENLABS_API_KEY=               # ElevenLabs - voice announcements

# Databases
MONGODB_URI=                      # MongoDB Atlas connection string
SPACETIMEDB_URI=                  # SpacetimeDB module address
SPACETIMEDB_MODULE_NAME=          # Published module name

# Authentication
SESSION_SECRET=                   # iron-session signing secret (32+ characters)

# Client-side (NEXT_PUBLIC_*)
NEXT_PUBLIC_SPACETIMEDB_URI=      # Client-side SpacetimeDB URI
NEXT_PUBLIC_SPACETIMEDB_MODULE=   # Client-side module name
```

### SpacetimeDB Rust Module Structure

```
/spacetimedb-module/
  src/
    lib.rs                        ← module entry point
    tables/
      events.rs                   ← events table + create_event reducer
      tasks.rs                    ← tasks table + complete/flag/note reducers
      operators.rs                ← operators table + auth query
      checkpoints.rs              ← checkpoints table + pass/fail reducers
      announcements.rs            ← announcements table + create reducer
      teams.rs                    ← teams table (live mode)
      scores.rs                   ← score events table (live mode)
    logic/
      dependency_check.rs         ← check_and_unlock_dependents()
      checkpoint_check.rs         ← check_checkpoint_readiness()
      scope_auth.rs               ← operator scope validation
      freeze_logic.rs             ← freeze status handling (live mode)
      rule_override.rs            ← forward-only overrides (live mode)
```

### ElevenLabs Voice Integration

ElevenLabs Turbo v2 is primary voice. Browser `SpeechSynthesis` is fallback. Always call `speak()` utility — never call ElevenLabs directly from components.

```typescript
// lib/speak.ts
export async function speak(text: string) {
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text, model_id: 'eleven_turbo_v2' })
    })
    const audio = new Audio(URL.createObjectURL(await res.blob()))
    audio.play()
  } catch {
    // Fallback - judge still hears a voice
    const utterance = new SpeechSynthesisUtterance(text)
    window.speechSynthesis.speak(utterance)
  }
}
```

Call `speak()` on: checkpoint passed, Go/No-Go passed, major announcements.

---

## Build Plan (6-8 Hours)

**⚠ Build in this exact order. Always have something demoable at end of each block.**

| **Time** | **What to Build** | **Done When** |
|---|---|---|
| **0:00 - 0:30** | Next.js 14 setup + Tailwind v3 + shadcn/ui + Framer Motion + all env vars. Create 5 empty page shells. | `npm run dev` loads without errors |
| **0:30 - 1:30** | SpacetimeDB Rust module: events, tasks, operators, checkpoints, announcements tables. `complete_task` reducer with scope check + dependency unlock. `spacetime publish`. | `spacetime publish` succeeds |
| **1:30 - 2:15** | POST /api/plan streaming route + Gemini system prompt. Test with curl until JSON output reliable. | Gemini returns valid EventConfig JSON |
| **2:15 - 3:00** | POST /api/commit: parse EventConfig, two-pass resolve depends_on_titles → IDs, batch create tasks + operators + checkpoints. | Event + tasks appear in SpacetimeDB |
| **3:00 - 4:30** | Screen 1: PlanningChat streaming UI, EventConfigPreview card, Launch button, operator codes display. | End-to-end: type description → see tasks → launch → codes shown |
| **4:30 - 6:00** | Screen 2: PhaseBoard + TaskCard + ProgressRing + SpacetimeDB subscription live updates on manager dashboard. | Dashboard updates real-time when task completed in console |
| **6:00 - 7:00** | Screen 3: Volunteer task view, scoped task list, Mark Complete, locked state, Flag Blocker, notes field. | Two tabs - volunteer marks done, manager sees it <300ms |
| **7:00 - 7:30** | POST /api/auth with iron-session, role-based redirect, session middleware on protected routes. | Director and volunteer log in with different codes |
| **7:30 - 8:00** | Checkpoint pass/fail logic, Go/No-Go phase, `speak()` on checkpoint pass, Framer animations, Sonner toasts, demo data. | **Demo runs: setup → Go/No-Go in <3 minutes** |
| **Optional +2-4 hours** | Screens 4-5: Live scoreboard + game control panel for quiz/game mode. Add teams table, scoring reducers, voice input. | Live quiz demo functional |

---