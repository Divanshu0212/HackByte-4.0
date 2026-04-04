# ⚡ Elixa — Technical Reference

---

## What It Does

Real-time AI-assisted event management for live quizzes and games. Manager describes the event in plain language → agent produces a config → live scoreboard runs → operators update state via voice → spectator display animates in real time → agent handles mid-event exceptions without touching past data.

---

## Two Scenarios

**Scenario 1 — Quiz:** Round-based scoring, elimination rules, live leaderboard. Manager and operators score teams via voice or tap.

**Scenario 2 — Live Game (Treasure Hunt / Campus Quest):** Checkpoint-based game described in plain language. Agent compiles rules into a Rule Manifest before the event. Checkpoint marshals mark arrivals via voice.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS v4 |
| UI Primitives | shadcn/ui |
| Layout Animation | Framer Motion v11 |
| Number Animation | React Spring v9 |
| Confetti | canvas-confetti |
| Sound | Howler.js |
| Toasts | Sonner |
| Icons | Lucide React |
| Real-time State | SpacetimeDB |
| Persistence | MongoDB Atlas |
| AI — Planning + Agent | Gemini 1.5 Flash |
| AI — Rule Manifest | Claude claude-sonnet-4-20250514 |
| AI Streaming | Vercel AI SDK |
| Voice Input | Web Speech API (native) |
| Voice Output | ElevenLabs Turbo v2 |
| Avatar Generation | DiceBear v7 |
| Deployment | Vultr |

**Not used:** localStorage / sessionStorage, Socket.io / Pusher, Redux / Zustand, any component library other than shadcn/ui.

---

## Three AI Calls — Strictly Enforced

Everything outside these three is deterministic (pattern matcher → SpacetimeDB reducer).

**1. Event Setup**
Manager describes the event in plain language. Gemini extracts the full `EventConfig`. One call per event at launch.

**2. Mid-Event Agent**
Manager sends a change the pattern matcher cannot handle (rule override, team freeze, score correction, tiebreak definition). Gemini receives full `EventConfig` + live state + conversation history, returns a proposal JSON. Manager confirms. Reducer fires. Past data is never touched.

**3. Post-Event Summary**
Gemini reads score history + override log from MongoDB, returns a narrative summary.

**Scenario 2 only — Rule Manifest Compilation (Claude)**
One pre-session call before event launch. Plain language game description → structured JSON Rule Manifest. Stored in `EventConfig.rule_manifest`. Used by the pattern matcher at runtime for non-linear scoring triggers.

---

## Command Routing Algorithm

```
INPUT RECEIVED (voice or typed)
        ↓
Run against pattern registry
        ↓
MATCH?
  YES → fire SpacetimeDB reducer directly
        (<50ms, no LLM in path)
  NO  → send to Gemini with full context
          → Gemini returns proposal JSON
          → show ConfirmationCard to manager
          → manager confirms or cancels
          → if confirmed: fire reducer
            if cancelled: discard
```

**Pattern registry:**
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

---

## Mid-Event Agent Rules

- **Forward-only by default.** Every change applies from now onward. Past rounds are immutable.
- **Confirm before execute.** Agent never changes state silently. Always shows a ConfirmationCard with what changes and what doesn't.
- **Explicit corrections only.** Touching past scores requires a stated reason, which is logged permanently.

**Agent proposal output format:**
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

---

## Freeze Logic

Frozen teams receive delta = 0 for every scoring event during the freeze window. Score is not deducted — they simply gain nothing. Every blocked event is still logged as `frozen_noop`.

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

---

## Rule Override Logic

Overrides are stored separately in `rule_overrides`. The original `EventConfig` is never mutated. At scoring time, overrides are applied on top.

```rust
reducer override_round_rule(
    event_id: String,
    round_number: u32,
    field: RuleField,       // correct_delta | wrong_delta | elimination
    new_value: Option<i32>,
    effective_from: Timestamp,
)
```

Scope: a single round, or forward from a timestamp. Never retroactive.

---

## Rule Manifest Compilation (Scenario 2)

```javascript
async function compileRuleManifest(description) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: `You are a game rules compiler. Extract a strict JSON Rule Manifest.
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

When `scoringType` is `non_linear`, the pattern matcher runs commands against manifest trigger phrases instead of the static registry. Multi-action triggers are dispatched as a batch to SpacetimeDB.

---

## SpacetimeDB Reducers

```
create_event
add_score_event           // checks freeze_status before applying delta
reverse_score_event       // undo
reverse_n_score_events
start_round
end_round
freeze_team               // sets freeze_status + freeze_until condition
thaw_team
override_round_rule       // forward-only rule patch
manual_score_correction   // requires reason string, always logged
add_one_time_modifier     // tiebreak bonus, sudden death, custom bonus
claim_modifier            // expires modifier after one use
record_checkpoint_arrival // first-arrival bonus logic (Scenario 2)
create_announcement
send_announcement
disqualify_team
eliminate_team
```

---

## Data Flow — Score Update (Routine)

```
voice/text input
    → pattern matcher: match found
    → SpacetimeDB reducer (freeze check → apply delta)
    → all clients update via subscription (<300ms)
    → Framer Motion rank reorder
    → React Spring score counter roll
    → Howler.js sound
    → ElevenLabs confirmation (async)
    → MongoDB write (async)
```

## Data Flow — Mid-Event Agent Call

```
voice/text input
    → pattern matcher: no match
    → POST /api/agent
        receives: EventConfig + live state + conversation history + message
    → Gemini returns proposal JSON
    → ConfirmationCard shown to manager
    → manager confirms
    → POST /api/action → SpacetimeDB reducer
    → all clients update
    → MongoDB logs: change + agent conversation excerpt + timestamp
```

---

## EventConfig Schema (Abridged)

```typescript
interface EventConfig {
  event_id:   string;
  name:       string;
  template:   "QUIZ" | "LIVE_GAME";
  status:     "planning" | "live" | "ended";

  teams: {
    id:           string;
    name:         string;
    color:        string;
    live_status:  "active" | "frozen" | "disqualified" | "eliminated";
    freeze_until?: "end_of_round" | "indefinite" | number;
  }[];

  rules: {
    scoring_events: { type: string; delta: number }[];
    elimination?:   { after_round: number; keep_top_n: number };
    tiebreak?:      "solve_time" | "none";
  };

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

  active_modifiers?: {
    type:          "tiebreak_bonus" | "sudden_death" | "custom_bonus";
    target:        "next_correct_team" | "specific_team" | "all_teams";
    delta:         number;
    expires_after: "one_claim" | "end_of_round" | "never";
  }[];

  operators: {
    code:      string;
    role:      "global" | "checkpoint" | "team";
    scope_id?: string;
  }[];

  announcements: {
    id:           string;
    message:      string;
    scheduled_at: number;
    sent:         boolean;
    voice:        boolean;
  }[];

  // Scenario 2 only
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

## Undo System (Command Pattern)

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

Agent-proposed changes (freezes, overrides) are not in the undo stack. They are reversed through a new agent interaction and logged.

---

## Animation Triggers

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

ElevenLabs narration fires inside `onLayoutAnimationComplete` — audio plays when the card settles, not before.

---

## API Keys Required

```bash
GOOGLE_GENERATIVE_AI_API_KEY=
ANTHROPIC_API_KEY=
ELEVENLABS_API_KEY=
MONGODB_URI=
SPACETIMEDB_URI=
SPACETIMEDB_MODULE_NAME=
```