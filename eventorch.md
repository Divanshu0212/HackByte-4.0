**⚡ ELIXA**

Pre-Event Orchestration Platform

_Describe your event. Watch it come alive._

**Technical Implementation Document**

HackByte 4.0 | PDPM IIITDM Jabalpur | MLH Official 2026 Season

# **1\. Project Overview & Problem Statement**

## **1.1 What is Elixa?**

Elixa is a pre-event orchestration platform powered by a master AI agent. It is designed for event organizers - specifically hackathon and college fest organizers - who currently manage pre-event coordination through WhatsApp groups, Excel sheets, and verbal check-ins.

Elixa replaces that entire coordination layer with a structured, real-time, role-based task management environment that is generated automatically from a single natural language description of the event.

## **1.2 The Problem**

Before any hackathon or college fest begins, the organizing team needs to complete 30-60 tasks across multiple departments:

- Permissions and approvals from institute administration
- Venue booking and logistics
- Sponsor outreach and confirmation
- Participant registration setup
- Volunteer briefing and role assignment
- Food, accommodation, and on-ground logistics
- Tech infrastructure - WiFi, projectors, power
- Final Go/No-Go review before event launch

Currently this is managed entirely informally. One person holds all context in their head. Coordination happens over WhatsApp. Tasks fall through the cracks because there is no single source of truth visible to everyone simultaneously.

## **1.3 The Solution - One Core Workflow**

The Checklist-to-Checkpoint Pipeline: a phased, AI-generated pre-event task management system with real-time updates, role-based access, and dependency-locked progression.

| **Phase**     | **What Happens**                                           | **Who Owns It**       |
| ------------- | ---------------------------------------------------------- | --------------------- |
| Permissions   | Get all institutional approvals. Confirm dates with admin. | Director              |
| Venue         | Book hall, confirm capacity, arrange layout.               | Venue Lead            |
| Sponsors      | Outreach, follow-ups, confirm commitments.                 | Sponsor Lead          |
| Registrations | Open DevFolio, confirm team count, set deadlines.          | Tech Lead             |
| Volunteers    | Brief all volunteers, assign roles, confirm availability.  | Volunteer Coordinator |
| Go / No-Go    | Final review - all critical items green before launch.     | Director              |

# **2\. System Architecture**

## **2.1 High-Level Architecture**

Elixa is built on three layers:

| **Layer**       | **Technology**                     | **Role**                                          |
| --------------- | ---------------------------------- | ------------------------------------------------- |
| Frontend        | Next.js 14 (App Router)            | Manager dashboard, volunteer view, agent chat UI  |
| Real-Time State | SpacetimeDB                        | Live task status sync across all users instantly  |
| Persistence     | MongoDB Atlas                      | Event history, agent logs, task audit trail       |
| AI Agent        | Gemini 2.5 Flash via Vercel AI SDK | Parse event description → generate task structure |
| Styling         | Tailwind CSS v3 + shadcn/ui        | Component library, dark theme                     |
| Animation       | Framer Motion                      | Task completion animations, progress transitions  |
| Voice           | ElevenLabs Turbo v2                | Announcements, checkpoint narration               |

**⚠ Use Tailwind CSS v3 - NOT v4. shadcn/ui is not stable with Tailwind v4 yet.**

## **2.2 Request Flow - Manager Creates Event**

- Manager opens Elixa, types event description in plain English
- POST /api/plan → Gemini parses description → streams structured EventConfig JSON
- Manager reviews EventConfig preview card before committing
- POST /api/commit → EventConfig committed to SpacetimeDB (events table)
- Agent auto-generates task list → committed to SpacetimeDB (tasks table)
- Role codes auto-generated → committed to SpacetimeDB (operators table)
- Manager dashboard activates with full task view
- Volunteer receives their code → logs in → sees scoped task view
- Any task marked complete → SpacetimeDB fires subscription update → all clients update in <300ms

**⚠ CRITICAL: /api/plan only streams text. /api/commit only writes to DB. Never merge these two routes - combining streaming with DB writes breaks the stream entirely.**

## **2.3 Request Flow - Volunteer Marks Task Complete**

- Volunteer taps 'Mark Complete' on their task
- Optimistic UI update applied immediately - task turns green locally before server confirms
- POST /api/action → SpacetimeDB reducer: complete_task(task_id, operator_id)
- Reducer checks: is this operator scoped to this task?
- If yes → task.status = 'complete', completion_timestamp recorded
- Check if dependent tasks now unlock → update their status to 'available'
- SpacetimeDB subscription fires to all connected clients
- Manager dashboard: task turns green, progress bar advances, completion % updates
- If reducer fails → revert optimistic update, show Sonner error toast
- Async: MongoDB write to task_history collection

# **3\. Database Design - SpacetimeDB + MongoDB**

## **3.1 SpacetimeDB Tables (Live State)**

SpacetimeDB holds all live state. Every connected client subscribes to relevant tables and receives updates automatically. No polling. No manual refresh.

**events table**

| **Column**        | **Type**             | **Description**                                    |
| ----------------- | -------------------- | -------------------------------------------------- |
| event_id          | String (UUID)        | Auto-generated unique identifier                   |
| name              | String               | Event name - e.g. HackByte 4.0                     |
| description       | String               | Original natural language description from manager |
| date              | u64 (unix timestamp) | Event date                                         |
| venue             | String               | Venue name                                         |
| participant_count | u32                  | Expected number of participants                    |
| status            | Enum                 | planning \| active \| completed                    |
| created_at        | u64                  | Creation timestamp                                 |
| director_id       | String               | Manager's user ID                                  |

**tasks table**

| **Column**    | **Type**          | **Description**                                                                                                                          |
| ------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| task_id       | String (UUID)     | Unique task identifier                                                                                                                   |
| event_id      | String            | FK → events.event_id                                                                                                                     |
| title         | String            | Task name - e.g. 'Confirm venue booking'                                                                                                 |
| description   | String            | Detailed description of what needs to be done                                                                                            |
| phase         | Enum              | permissions \| venue \| sponsors \| registrations \| volunteers \| gonogo                                                                |
| status        | Enum              | locked \| available \| in_progress \| completed \| blocked                                                                               |
| assigned_role | String            | Role code of the responsible operator - never empty                                                                                      |
| assigned_to   | String (nullable) | Specific operator ID if individually assigned                                                                                            |
| depends_on    | Vec&lt;String&gt; | List of task_ids that must complete first. NOTE: AI returns depends_on_titles - must be resolved to IDs at commit time. See Section 4.4. |
| deadline      | u64 (nullable)    | Unix timestamp - suggested by agent                                                                                                      |
| priority      | Enum              | critical \| high \| medium \| low                                                                                                        |
| completed_at  | u64 (nullable)    | Completion timestamp                                                                                                                     |
| completed_by  | String (nullable) | Operator ID who marked complete                                                                                                          |
| notes         | String            | Optional notes added by operator                                                                                                         |
| created_at    | u64               | Task creation timestamp                                                                                                                  |

**⚠ CRITICAL: The AI (Gemini) returns depends_on_titles as task title strings. SpacetimeDB needs task_ids. You MUST resolve titles → IDs in commitEventConfig before writing to DB. See Section 4.4 for the exact two-pass resolution code.**

**operators table**

| **Column**  | **Type**          | **Description**                                                                     |
| ----------- | ----------------- | ----------------------------------------------------------------------------------- |
| operator_id | String            | Auto-generated access code - e.g. OP-VEN-4A2B                                       |
| event_id    | String            | FK → events.event_id                                                                |
| role        | Enum              | director \| venue_lead \| sponsor_lead \| tech_lead \| volunteer_coord \| volunteer |
| label       | String            | Human-readable label - e.g. 'Venue Lead'                                            |
| scope       | Vec&lt;String&gt; | Phase(s) this operator can update                                                   |
| name        | String (nullable) | Name of the person holding this role                                                |
| last_active | u64 (nullable)    | Last seen timestamp                                                                 |

**checkpoints table**

| **Column**        | **Type**          | **Description**                                |
| ----------------- | ----------------- | ---------------------------------------------- |
| checkpoint_id     | String            | Unique checkpoint identifier                   |
| event_id          | String            | FK → events.event_id                           |
| phase             | Enum              | Which phase this checkpoint closes             |
| name              | String            | e.g. 'Venue Confirmed', 'Sponsors Locked'      |
| status            | Enum              | locked \| available \| passed \| failed        |
| required_task_ids | Vec&lt;String&gt; | All tasks that must be complete to unlock      |
| passed_at         | u64 (nullable)    | Timestamp when director passed this checkpoint |
| passed_by         | String (nullable) | Director ID                                    |

**announcements table**

| **Column**      | **Type** | **Description**                    |
| --------------- | -------- | ---------------------------------- |
| announcement_id | String   | Unique ID                          |
| event_id        | String   | FK → events.event_id               |
| message         | String   | Announcement text                  |
| scheduled_at    | u64      | Unix timestamp (0 = immediate)     |
| sent            | bool     | Whether it has been delivered      |
| voice           | bool     | Whether ElevenLabs should speak it |
| created_by      | String   | Operator ID of creator             |

## **3.2 MongoDB Collections (Persistence & History)**

| **Collection**   | **Purpose**                           | **Key Fields**                                                |
| ---------------- | ------------------------------------- | ------------------------------------------------------------- |
| events_archive   | Archived completed events             | event_id, name, date, final_status, created_at                |
| task_history     | Audit trail of all task state changes | task_id, from_status, to_status, changed_by, timestamp, notes |
| agent_conv_log   | Full planning conversation history    | event_id, messages\[\], config_output, created_at             |
| override_log     | Manual overrides by director          | event_id, task_id, action, reason, timestamp, director_id     |
| announcement_log | All sent announcements                | event_id, message, sent_at, voice, delivered_to_count         |

# **4\. Master AI Agent - Gemini Integration**

## **4.1 What the Agent Does**

The master agent runs exactly once - at event creation. It parses a plain English description of the event and produces a fully structured EventConfig JSON that seeds the entire SpacetimeDB environment: tasks, roles, dependencies, deadlines, and checkpoints.

After this, the agent does not make autonomous decisions. Every subsequent update is either a direct operator action or a director-confirmed override.

## **4.2 System Prompt**

The following system prompt is sent to Gemini 1.5 Flash on every planning call:

You are Elixa's event planning agent. Your job is to parse a plain

English description of an event and produce a structured EventConfig.

RULES:

1\. Ask at most 2 clarifying questions if critical info is missing.

2\. Never guess volunteer count - always ask if not stated.

3\. Generate realistic deadlines relative to the event date.

4\. Always generate a Go/No-Go phase as the final checkpoint.

5\. Assign every task to a role - never leave assigned_role empty.

6\. Output ONLY valid JSON. No preamble, no explanation, no markdown fences.

OUTPUT SCHEMA:

{

"name": string,

"date": ISO8601 string,

"venue": string,

"participant_count": number,

"phases": \[

{

"id": "permissions" | "venue" | "sponsors" | "registrations" | "volunteers" | "gonogo",

"label": string,

"tasks": \[

{

"title": string,

"description": string,

"assigned_role": string,

"priority": "critical" | "high" | "medium" | "low",

"deadline": ISO8601 string,

"depends_on_titles": string\[\]

}

\]

}

\],

"roles": \[

{ "role": string, "label": string, "scope": string\[\] }

\]

}

**⚠ Set temperature: 0.2 - low temperature for consistent JSON output. Higher values produce broken JSON in production.**

## **4.3 API Route - POST /api/plan**

_→ This route ONLY streams Gemini output. It does NOT write to any database._

// app/api/plan/route.ts

import { streamText } from 'ai'

import { google } from '@ai-sdk/google'

export async function POST(req: Request) {

const { messages } = await req.json()

const result = await streamText({

model: google('gemini-1.5-flash-latest'),

system: PLANNING_AGENT_SYSTEM_PROMPT,

messages,

temperature: 0.2,

})

return result.toDataStreamResponse()

}

## **4.4 Parsing & Committing EventConfig - THE CRITICAL FIX**

**⚠ Copilot WILL skip the depends_on_titles → task_id resolution. Without this, dependency locking is completely broken. Do not skip it.**

Gemini returns depends_on_titles as an array of task title strings (e.g. \['Confirm venue booking'\]). SpacetimeDB stores depends_on as task_ids. You must do a two-pass resolution in commitEventConfig.ts - generate all task IDs first, build a title→id map, then resolve dependencies second.

// lib/commitEventConfig.ts

export async function commitEventConfig(config: EventConfig) {

const conn = await SpacetimeDB.connect(process.env.SPACETIMEDB_URI)

// 1. Create event record

await conn.call('create_event', {

name: config.name, date: config.date,

venue: config.venue, participant_count: config.participant_count

})

// 2. Create operator codes for each role

for (const role of config.roles) {

await conn.call('create_operator', {

role: role.role, label: role.label, scope: role.scope

})

}

// 3. FIRST PASS - generate all task IDs, build title→id map

const titleToId: Record&lt;string, string&gt; = {}

const stagedTasks: any\[\] = \[\]

for (const phase of config.phases) {

for (const task of phase.tasks) {

const id = generateUUID()

titleToId\[task.title\] = id

stagedTasks.push({ ...task, task_id: id, phase: phase.id, depends_on: \[\] })

}

}

// 4. SECOND PASS - resolve depends_on_titles to actual task_ids

for (const task of stagedTasks) {

task.depends_on = (task.depends_on_titles ?? \[\])

.map((title: string) => titleToId\[title\])

.filter(Boolean)

}

// 5. Batch write resolved tasks to SpacetimeDB

await conn.call('create_tasks_batch', { tasks: stagedTasks })

// 6. Create phase checkpoints

await conn.call('create_checkpoints', { phases: config.phases })

}

# **5\. The Core Workflow - Pre-Event Checklist Pipeline**

## **5.1 The Six Phases**

Every event generated by Elixa follows this exact phase sequence. Each phase is a checkpoint. A phase cannot be passed until all its critical tasks are complete.

| **Phase**         | **Example Tasks Generated**                                                          | **Checkpoint Condition**                     |
| ----------------- | ------------------------------------------------------------------------------------ | -------------------------------------------- |
| 1\. Permissions   | Get institute NOC, confirm date with Dean, insurance clearance, food permission      | All critical tasks done + Director confirms  |
| 2\. Venue         | Book main hall, confirm AV equipment, arrange seating layout, power backup confirmed | Venue Lead marks all tasks done              |
| 3\. Sponsors      | Send sponsorship deck, follow up with 5 sponsors, confirm amounts, receive cheques   | Min 1 sponsor confirmed OR director override |
| 4\. Registrations | Open DevFolio, share registration link, confirm 200 registrations, shortlist teams   | Registration count threshold reached         |
| 5\. Volunteers    | Brief 15 volunteers, assign roles, confirm T-shirts, share event-day schedule        | All volunteers briefed + roles confirmed     |
| 6\. Go / No-Go    | Final checklist review, contingency plans confirmed, event declared ready            | Director passes final checkpoint manually    |

## **5.2 Dependency Locking**

Tasks within a phase can depend on other tasks. The system enforces this automatically:

- Task status starts as 'locked' if it has unmet dependencies
- When all dependency tasks are marked complete, the dependent task transitions to 'available'
- The volunteer can only interact with 'available' tasks - locked tasks are visible but non-interactive
- SpacetimeDB reducer check_and_unlock_dependents() fires after every task completion

// SpacetimeDB Rust reducer

# \[spacetimedb(reducer)\]

pub fn complete_task(

ctx: &ReducerContext,

task_id: String,

operator_id: String,

notes: Option&lt;String&gt;,

) -> Result&lt;(), String&gt; {

// 1. Verify operator is scoped to this task

let operator = Operator::filter_by_id(&operator_id)

.ok_or("Operator not found")?;

let task = Task::filter_by_id(&task_id)

.ok_or("Task not found")?;

if !operator.scope.contains(&task.phase) {

return Err("Operator not authorized for this task".into());

}

// 2. Mark task complete

task.status = TaskStatus::Completed;

task.completed_at = Some(ctx.timestamp);

task.completed_by = Some(operator_id.clone());

task.notes = notes;

Task::update_by_id(&task_id, task);

// 3. Check if any tasks were waiting on this one

check_and_unlock_dependents(ctx, &task_id)?;

// 4. Check if phase checkpoint is now passable

check_checkpoint_readiness(ctx, &task.event_id, &task.phase)?;

Ok(())

}

# **6\. Real-Time Synchronization**

## **6.1 SpacetimeDB Subscriptions**

Every connected client subscribes to relevant tables. Updates propagate automatically - no polling, no manual refresh.

// hooks/useEventState.ts

import { useSpacetimeDB } from '@spacetimedb/sdk-typescript'

export function useEventState(eventId: string) {

const { tasks, operators, checkpoints } = useSpacetimeDB({

uri: process.env.NEXT_PUBLIC_SPACETIMEDB_URI,

module: process.env.NEXT_PUBLIC_SPACETIMEDB_MODULE,

tables: \['tasks', 'operators', 'checkpoints', 'announcements'\],

filter: { event_id: eventId }

})

return { tasks, operators, checkpoints }

}

## **6.2 Update Propagation Timeline**

| **Action**                    | **Time to All Clients**     | **Path**                                                          |
| ----------------------------- | --------------------------- | ----------------------------------------------------------------- |
| Volunteer marks task complete | < 300ms                     | Client → API → SpacetimeDB reducer → subscription push            |
| Director passes checkpoint    | < 300ms                     | Client → API → SpacetimeDB reducer → subscription push            |
| Agent generates task list     | 2-8 seconds                 | Gemini inference → parse JSON → batch reducer → subscription push |
| Announcement sent             | < 500ms (text), ~1s (voice) | Reducer → subscription push + async ElevenLabs call               |

## **6.3 Optimistic Updates**

For task completion, Elixa applies an optimistic local update before the SpacetimeDB confirmation arrives. This makes the UI feel instant:

function handleTaskComplete(taskId: string) {

// Optimistic update - instant local state change

dispatch({ type: 'TASK_COMPLETE_OPTIMISTIC', taskId })

// Fire reducer - server confirms and broadcasts to all clients

callReducer('complete_task', { task_id: taskId, operator_id: currentOperator.id })

.catch(() => {

// Revert if reducer fails

dispatch({ type: 'TASK_COMPLETE_REVERT', taskId })

toast.error('Could not mark task complete - please try again')

})

}

# **7\. Role-Based Access Control**

## **7.1 Role Hierarchy**

| **Role**              | **Access Code Format** | **What They See**                                       | **What They Can Do**                                            |
| --------------------- | ---------------------- | ------------------------------------------------------- | --------------------------------------------------------------- |
| Director / Manager    | DIR-XXXX               | All phases, all tasks, all operators, progress overview | Everything - create event, pass checkpoints, override, announce |
| Venue Lead            | OP-VEN-XXXX            | Venue phase tasks only                                  | Mark venue tasks complete, add notes, flag blockers             |
| Sponsor Lead          | OP-SPO-XXXX            | Sponsor phase tasks only                                | Mark sponsor tasks complete, log sponsor confirmations          |
| Tech Lead             | OP-TEC-XXXX            | Registration + tech phase tasks                         | Mark tech tasks complete                                        |
| Volunteer Coordinator | OP-VOL-XXXX            | Volunteer phase tasks only                              | Mark tasks complete, assign sub-volunteers                      |
| Volunteer             | OP-V-XXXX              | Only their specific assigned tasks                      | Mark their tasks complete, add notes                            |

## **7.2 Access Code Login Flow**

- User opens Elixa URL and enters their access code
- POST /api/auth → SpacetimeDB query: find operator by code + event_id
- If found → iron-session cookie issued with { operator_id, role, scope, event_id }
- Redirect to role-appropriate dashboard (director → /dashboard, others → /volunteer)
- SpacetimeDB subscription filtered to operator's scope

**⚠ Do NOT use NextAuth - it is overkill for access codes and will waste your time configuring. Use iron-session with a signed cookie. Session payload: { operator_id, role, scope, event_id }.**

// app/api/auth/route.ts

export async function POST(req: Request) {

const { access_code, event_id } = await req.json()

const operator = await spacetimeDB.query(

'SELECT \* FROM operators WHERE operator_id = \$1 AND event_id = \$2',

\[access_code, event_id\]

)

if (!operator) return Response.json({ error: 'Invalid code' }, { status: 401 })

// Write iron-session cookie

const session = await createIronSession({ operator_id: operator.id, role: operator.role,

scope: operator.scope, event_id })

return Response.json({ role: operator.role })

}

# **8\. Frontend Architecture**

## **8.1 Three Core Screens - Build ONLY These Three**

**⚠ Build exactly three screens. Delete anything Copilot scaffolds beyond these. More screens = less time for polish.**

**Screen 1 - Manager Setup Chat**

Path: / (root)

- Text input where manager describes the event in plain language
- Streaming Gemini response via Vercel AI SDK useChat hook
- EventConfig preview card shown before commit - manager can review tasks, phases, role codes
- 'Launch Event' button → POST /api/commit → redirects to /dashboard/\[event_id\]
- Confirmation screen: generated operator codes shown with copy buttons

**Screen 2 - Manager Dashboard**

Path: /dashboard/\[event_id\]

- Phase cards arranged horizontally - Permissions → Venue → Sponsors → Registrations → Volunteers → Go/No-Go
- Each phase shows: task count, completion count, progress bar, checkpoint status
- Click phase to expand → see all tasks with status indicators
- Live completion percentage in top right - updates instantly via SpacetimeDB subscription
- 'Pass Checkpoint' button appears when all critical tasks in a phase are complete
- Operator activity feed on the right - who did what, when
- Announcement composer at bottom

**Screen 3 - Volunteer Task View**

Path: /volunteer/\[event_id\]

- Clean task list filtered to operator's scope only - nothing else visible
- Available tasks: green border, 'Mark Complete' button active
- Locked tasks: gray, shows what needs to complete first
- Completed tasks: checkmark, completion timestamp, non-interactive
- 'Flag Blocker' button on any task - notifies director instantly
- Notes field on each task - visible to director on dashboard

## **8.2 Key Components**

| **Component**      | **File**                          | **Purpose**                                         |
| ------------------ | --------------------------------- | --------------------------------------------------- |
| PlanningChat       | components/PlanningChat.tsx       | Agent chat interface with streaming Gemini response |
| EventConfigPreview | components/EventConfigPreview.tsx | Shows generated task structure before committing    |
| PhaseBoard         | components/PhaseBoard.tsx         | Horizontal phase cards on manager dashboard         |
| TaskCard           | components/TaskCard.tsx           | Individual task with status, notes, complete button |
| CheckpointBadge    | components/CheckpointBadge.tsx    | Visual indicator of phase checkpoint status         |
| ProgressRing       | components/ProgressRing.tsx       | Animated circular progress for overall completion   |
| OperatorFeed       | components/OperatorFeed.tsx       | Live activity feed of who did what                  |
| AnnouncementBar    | components/AnnouncementBar.tsx    | Compose and send announcements                      |

## **8.3 Design System Tokens**

Define once in globals.css - never hardcode colors anywhere in components.

/\* globals.css \*/

:root {

\--color-bg: #0A0A0F;

\--color-surface: #13131A;

\--color-border: #1E1E2E;

\--color-primary: #6C63FF; /\* purple - CTAs \*/

\--color-accent: #00D4FF; /\* cyan - live indicators \*/

\--color-success: #00E676; /\* task complete \*/

\--color-warning: #FFD600; /\* blocker flagged \*/

\--color-danger: #FF1744; /\* checkpoint failed \*/

\--color-text-primary: #F0F0FF;

\--color-text-muted: #8888AA;

\--font-heading: 'Clash Display', sans-serif;

\--font-body: 'DM Sans', sans-serif;

\--font-mono: 'JetBrains Mono', monospace;

}

# **9\. API Routes**

| **Method + Path**           | **Auth Required**    | **What it Does**                                                               |
| --------------------------- | -------------------- | ------------------------------------------------------------------------------ |
| POST /api/plan              | None                 | Streams Gemini response for event planning conversation. Does NOT write to DB. |
| POST /api/commit            | Director session     | Commits finalized EventConfig to SpacetimeDB. Separate from /api/plan.         |
| POST /api/auth              | None                 | Validates access code, returns iron-session cookie                             |
| POST /api/action            | Any operator session | Routes operator action to SpacetimeDB reducer                                  |
| POST /api/announce          | Director session     | Creates announcement, optionally triggers ElevenLabs voice                     |
| POST /api/checkpoint        | Director session     | Director passes or fails a phase checkpoint                                    |
| GET /api/event/\[id\]       | Any operator session | Returns current event state snapshot                                           |
| GET /api/tasks/\[event_id\] | Any operator session | Returns tasks filtered to operator scope                                       |
| POST /api/flag              | Any operator session | Flags a task as blocked, notifies director                                     |

## **9.1 POST /api/action - The Core Reducer Route**

All operator actions funnel through a single route that maps action_type to the correct SpacetimeDB reducer:

// app/api/action/route.ts

const PATTERN_MAP: Record&lt;string, string&gt; = {

complete_task: 'complete_task',

flag_blocker: 'flag_task_blocked',

add_note: 'add_task_note',

pass_checkpoint: 'pass_checkpoint',

fail_checkpoint: 'fail_checkpoint',

}

export async function POST(req: Request) {

const { action_type, payload } = await req.json()

const session = await getSession(req)

if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

const reducer = PATTERN_MAP\[action_type\]

if (!reducer) return Response.json({ error: 'Unknown action' }, { status: 400 })

await spacetimeDB.call(reducer, { ...payload, operator_id: session.operator_id })

return Response.json({ success: true })

}

# **10\. Tech Stack & Dependencies**

| **Category**    | **Library / Tool**  | **Version**     | **Purpose**                                  |
| --------------- | ------------------- | --------------- | -------------------------------------------- |
| Framework       | Next.js             | 14 (App Router) | Full-stack React framework, SSR, API routes  |
| Language        | TypeScript          | 5.x             | Type safety across frontend and API          |
| Styling         | Tailwind CSS        | v3              | Utility-first CSS, CSS variable theming      |
| UI Components   | shadcn/ui           | Latest          | Accessible, unstyled component primitives    |
| Animation       | Framer Motion       | v11             | Layout animations, task completion effects   |
| Real-Time State | SpacetimeDB         | Latest          | Live state sync across all connected clients |
| Database        | MongoDB Atlas       | Latest          | Event history, audit trail, agent logs       |
| AI - Planning   | Gemini 1.5 Flash    | Latest          | EventConfig extraction from natural language |
| AI SDK          | Vercel AI SDK       | Latest          | Streaming Gemini in planning chat            |
| Voice Output    | ElevenLabs Turbo v2 | Latest          | Announcements and checkpoint narration       |
| Auth Session    | iron-session        | Latest          | Signed cookie session - replaces NextAuth    |
| Icons           | Lucide React        | Latest          | Consistent icon set                          |
| Toasts          | Sonner              | Latest          | Action feedback notifications                |
| Avatars         | DiceBear            | v7              | Volunteer/role avatars from seed string      |
| Deployment      | Vultr               | -               | Live URL for demo                            |

## **10.1 Environment Variables**

\# .env.local

GOOGLE_GENERATIVE_AI_API_KEY= # Gemini - Google AI Studio

ELEVENLABS_API_KEY= # ElevenLabs - for announcements

MONGODB_URI= # MongoDB Atlas connection string

SPACETIMEDB_URI= # SpacetimeDB module address

SPACETIMEDB_MODULE_NAME= # Published module name

SESSION_SECRET= # iron-session signing secret (32+ char string)

NEXT_PUBLIC_SPACETIMEDB_URI= # Client-side SpacetimeDB URI

NEXT_PUBLIC_SPACETIMEDB_MODULE= # Client-side module name

## **10.2 SpacetimeDB Rust Module Structure**

/spacetimedb-module/

src/

lib.rs ← module entry point

tables/

events.rs ← events table + create_event reducer

tasks.rs ← tasks table + complete/flag/note reducers

operators.rs ← operators table + auth query

checkpoints.rs ← checkpoints table + pass/fail reducers

announcements.rs ← announcements table + create reducer

logic/

dependency_check.rs ← check_and_unlock_dependents()

checkpoint_check.rs ← check_checkpoint_readiness()

scope_auth.rs ← operator scope validation

## **10.3 ElevenLabs - Voice with Fallback**

ElevenLabs Turbo v2 is the primary voice. Browser SpeechSynthesis is the fallback. Always call the speak() utility - never call ElevenLabs directly from components. This ensures the demo Go/No-Go moment works even if ElevenLabs has latency or rate-limit issues.

// lib/speak.ts

export async function speak(text: string) {

try {

const res = await fetch('<https://api.elevenlabs.io/v1/text-to-speech/{voice_id}>', {

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

const u = new SpeechSynthesisUtterance(text)

window.speechSynthesis.speak(u)

}

}

Call speak() on: checkpoint passed, Go/No-Go passed, major announcements sent by director.

# **11\. Build Plan (4-8 Hours)**

**⚠ Build in this exact order. You always have something demoable at the end of each block. Never jump ahead.**

| **Hours**   | **What to Build**                                                                                                                                                    | **Done When**                                                   |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 0 - 0:30    | Next.js 14 setup + Tailwind v3 + shadcn/ui + Framer Motion + all env vars configured. Create 3 empty page shells: /, /dashboard/\[id\], /volunteer/\[id\].           | npm run dev loads without errors                                |
| 0:30 - 1:30 | SpacetimeDB Rust module: events, tasks, operators, checkpoints, announcements tables. complete_task reducer with scope check + dependency unlock. spacetime publish. | spacetime publish succeeds                                      |
| 1:30 - 2:15 | POST /api/plan streaming route + Gemini system prompt. Test in isolation with curl until JSON output is reliable and consistently valid.                             | Gemini returns valid EventConfig JSON                           |
| 2:15 - 3:00 | POST /api/commit: parse EventConfig, two-pass resolve depends_on_titles → IDs (Section 4.4), batch create tasks + operators + checkpoints in SpacetimeDB.            | Event + tasks appear in SpacetimeDB after commit                |
| 3:00 - 4:30 | Screen 1: PlanningChat streaming UI, EventConfig preview card, Launch button, operator codes display on confirmation.                                                | End-to-end: type description → see tasks → launch → codes shown |
| 4:30 - 6:00 | Screen 2: PhaseBoard + TaskCard + ProgressRing + SpacetimeDB subscription live updates on manager dashboard.                                                         | Dashboard updates in real time when task completed in console   |
| 6:00 - 7:00 | Screen 3: Volunteer task view, scoped task list, Mark Complete, locked state, Flag Blocker, notes field.                                                             | Two browser tabs - volunteer marks done, manager sees it <300ms |
| 7:00 - 7:30 | POST /api/auth with iron-session, role-based redirect, session middleware on protected routes.                                                                       | Director and volunteer log in with different codes              |
| 7:30 - 8:00 | Checkpoint pass/fail logic, Go/No-Go phase, speak() on checkpoint pass, Framer Motion completion animations, Sonner toasts, demo data pre-loaded.                    | Demo runs cleanly: setup → Go/No-Go in under 3 minutes          |

# **12\. Demo Script**

## **12.1 The 3-Minute Demo**

This is the exact sequence to run during the presentation. Practice it until it takes under 3 minutes.

**Minute 1 - Setup (The AI Moment)**

- Open Elixa on a laptop. Second screen shows the volunteer view on a phone.
- Type into planning chat: "HackByte 4.0, 24-hour hackathon, 200 participants, IIITDM Jabalpur, April 20. 5 volunteers. Need permissions, venue, sponsors, registrations sorted."
- Show Gemini streaming the response - tasks appearing in real time.
- Show the EventConfig preview card - 6 phases, ~30 tasks, 5 role codes generated.
- Click Launch. Say: "That one conversation just replaced 2 hours of setup."

**Minute 2 - Real-Time Update (The Wow Moment)**

- Open the volunteer view on the phone with the Venue Lead code.
- Show that the phone only sees venue tasks - nothing else.
- On the phone, mark 'Confirm venue booking' as complete.
- On the laptop (manager dashboard), point to the task turning green INSTANTLY.
- Show the progress bar advancing. Say: "No WhatsApp message. No phone call. The manager saw it the second it happened."
- Show the dependent task 'Arrange seating layout' unlocking automatically.

**Minute 3 - Go/No-Go (The Payoff)**

- Rapidly mark several tasks complete to advance the demo state.
- Show the Go/No-Go checkpoint becoming available.
- Director clicks 'Pass Go/No-Go Checkpoint'.
- ElevenLabs speaks: "All systems confirmed. HackByte 4.0 is ready to launch."
- Say: "This is what we replaced: 60 WhatsApp messages, 3 Google Sheets, and 4 hours of coordination calls."

## **12.2 Anticipated Judge Questions**

| **Question**                          | **Answer**                                                                                                                                                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Why not just use Trello?              | Trello requires manual setup - you build columns, create cards, assign people. Elixa generates the entire structure from one sentence. The AI knows what tasks a hackathon needs. Trello doesn't.          |
| What if the AI generates wrong tasks? | The EventConfig preview lets the director edit before committing. Any task can be added, removed, or reassigned after launch through the director dashboard. The AI is a starting point, not a final word. |
| How is this different from Notion?    | Notion is a general-purpose tool. Elixa is event-native. Real-time sync across roles, dependency locking, phase checkpoints, and AI generation are built-in - not plugins you configure.                   |
| Does this work during the event too?  | This version focuses on pre-event orchestration - getting from idea to 'doors open.' That's the workflow every organizer actually needs first.                                                             |
| What happens after Go/No-Go?          | The event is declared ready. Operator codes are shared with volunteers. The director has a complete audit trail of every task, who completed it, and when. This becomes the event's institutional memory.  |

**ELIXA - Technical Implementation Document**

HackByte 4.0 | PDPM IIITDM Jabalpur | MLH Official 2026 Season | Theme: Patch the Reality