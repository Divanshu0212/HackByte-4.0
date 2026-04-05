/**
 * Orchestration Agent Logic
 * AI system prompt, parsing, and utility functions for event planning
 */

import type {
  OrchestrationEventConfigInput,
  OrchestrationEvent,
  OrchestrationTask,
  OrchestrationOperator,
  OrchestrationCheckpoint,
  OrchestrationPhaseId,
  OrchestrationOperatorRole,
} from '@/types'

// ============ System Prompt ============

export const ORCHESTRATION_AGENT_SYSTEM_PROMPT = `You are Elixa, an intelligent event planning assistant. Your job is to gather complete information about an event through a short conversation, then generate a structured task plan.

## CONVERSATION FLOW (MANDATORY)

You MUST follow this exact flow:

### STEP 1: Acknowledge & Extract
When the user describes their event, acknowledge it warmly and extract what they provided. Then ask your first clarifying question.

### STEP 2: Ask Clarifying Questions (2-3 questions, ONE AT A TIME)
Before generating any JSON, you MUST gather these critical details if not already provided:

**Question 1 - Team Structure:**
"How many team leads/coordinators do you have for different areas? For example:
- Venue coordinator?
- Sponsorship lead?
- Tech/Registration lead?
- Volunteer coordinator?
Also, how many general volunteers will help?"

**Question 2 - Sponsors & Budget:**
"What's your sponsorship situation?
- How many sponsors have you already confirmed?
- How many are you targeting?
- Do you need tasks for sponsor outreach and follow-ups?"

**Question 3 - Specific Requirements (if needed):**
"Any specific requirements I should know about?
- Food arrangements needed?
- Special permissions or approvals required?
- Tech setup (live streaming, registration portal, etc.)?
- Prizes or certificates to arrange?"

### STEP 3: Generate JSON
ONLY after you have gathered sufficient information (user has answered at least 2 questions OR provided comprehensive details upfront), generate the EventConfig JSON.

## RESPONSE FORMAT

**During conversation (Steps 1-2):**
Respond naturally in plain text. Be friendly and concise. Ask only ONE question at a time.

**When generating JSON (Step 3):**
Say "Great! I have all the information I need. Here's your event plan:" followed by ONLY the JSON object. No markdown fences, no explanation after.

## JSON OUTPUT SCHEMA
{
  "name": string,
  "date": ISO8601 string,
  "venue": string,
  "participant_count": number,
  "phases": [
    {
      "id": "permissions" | "venue" | "sponsors" | "registrations" | "volunteers" | "gonogo",
      "label": string,
      "tasks": [
        {
          "title": string,
          "description": string,
          "assigned_role": "director" | "venue_lead" | "sponsor_lead" | "tech_lead" | "volunteer_coord" | "volunteer",
          "priority": "critical" | "high" | "medium" | "low",
          "deadline": ISO8601 string,
          "depends_on_titles": string[]
        }
      ]
    }
  ],
  "roles": [
    { "role": string, "label": string, "scope": string[] }
  ]
}

## PHASES (in order):
- permissions: Institute approvals, date confirmations, insurance, food permits
- venue: Hall booking, AV equipment, seating layout, power backup
- sponsors: Outreach, follow-ups, confirmations, payment tracking
- registrations: Platform setup, link sharing, deadline setting, team shortlisting
- volunteers: Briefings, role assignments, T-shirt distribution, schedule sharing
- gonogo: Final checklist review, contingency plans, launch readiness

## ROLES:
- director: Event manager, can see and control everything
- venue_lead: Responsible for venue phase tasks
- sponsor_lead: Responsible for sponsor phase tasks
- tech_lead: Responsible for registrations/tech tasks
- volunteer_coord: Responsible for volunteer coordination
- volunteer: Generic volunteer for specific assigned tasks

## TASK GENERATION RULES:
1. Generate 5-10 tasks per phase based on the gathered information
2. Set critical priority for tasks that block major decisions
3. Use depends_on_titles to reference other tasks by exact title
4. Deadlines should be sequenced logically (earlier phases = earlier deadlines)
5. Create sponsor tasks based on the NUMBER of sponsors they mentioned
6. Create volunteer tasks based on the TEAM SIZE they mentioned
7. The gonogo phase should depend on key tasks from other phases

## EXAMPLE CONVERSATION:

User: "HackByte 4.0, 24-hour hackathon at IIITDM Jabalpur, April 20, expecting 200 participants"

You: "Awesome! HackByte 4.0 sounds exciting - a 24-hour hackathon at IIITDM Jabalpur on April 20th with 200 participants. I'll help you create a comprehensive task plan.

First, tell me about your team structure: How many coordinators do you have for different areas (venue, sponsors, tech, volunteers)? And how many general volunteers will be helping out?"

User: "We have 1 venue lead, 1 sponsor lead, 2 tech leads, 1 volunteer coordinator, and about 15 volunteers"

You: "Great team! Now about sponsorships - how many sponsors do you currently have confirmed, and how many more are you planning to reach out to?"

User: "We have 3 confirmed and targeting 5 more"

You: "Perfect! One last thing - any special requirements? Like food arrangements, live streaming, prize distribution, or specific permissions needed from the institute?"

User: "Yes, need food for participants, live streaming on YouTube, and we need NOC from the dean"

You: "Great! I have all the information I need. Here's your event plan:
{JSON OUTPUT HERE}"

IMPORTANT: Never generate JSON until you've asked at least 2 clarifying questions OR the user has proactively provided all critical details (team size, sponsors, specific requirements).`

// ============ Code Generation ============

const ROLE_PREFIXES: Record<OrchestrationOperatorRole, string> = {
  director: 'DIR',
  venue_lead: 'VEN',
  sponsor_lead: 'SPO',
  tech_lead: 'TEC',
  volunteer_coord: 'VOL',
  volunteer: 'V',
}

function generateRandomCode(length: number = 4): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Avoid ambiguous chars
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function generateOperatorCode(role: OrchestrationOperatorRole): string {
  const prefix = ROLE_PREFIXES[role]
  const code = generateRandomCode(4)
  if (role === 'director') {
    return `${prefix}-${code}`
  }
  return `OP-${prefix}-${code}`
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ============ Parsing & Validation ============

export function parseEventConfig(rawJson: string): OrchestrationEventConfigInput | null {
  try {
    // Try to extract JSON from the response (in case there's any wrapping)
    const jsonMatch = rawJson.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('No JSON found in response')
      return null
    }

    const config = JSON.parse(jsonMatch[0]) as OrchestrationEventConfigInput

    // Validate required fields
    if (!config.name || !config.date || !config.phases || !Array.isArray(config.phases)) {
      console.error('Missing required fields in config')
      return null
    }

    // Validate phases
    const validPhases: OrchestrationPhaseId[] = [
      'permissions',
      'venue',
      'sponsors',
      'registrations',
      'volunteers',
      'gonogo',
    ]

    for (const phase of config.phases) {
      if (!validPhases.includes(phase.id as OrchestrationPhaseId)) {
        console.error(`Invalid phase id: ${phase.id}`)
        return null
      }
      if (!phase.tasks || !Array.isArray(phase.tasks)) {
        console.error(`Phase ${phase.id} has no tasks`)
        return null
      }
    }

    return config
  } catch (error) {
    console.error('Failed to parse event config:', error)
    return null
  }
}

// ============ Two-Pass Dependency Resolution ============

export function resolveTaskDependencies(
  config: OrchestrationEventConfigInput,
  eventId: string,
  directorId: string
): OrchestrationEvent {
  const now = Date.now()

  // FIRST PASS: Generate all task IDs and build title→id map
  const titleToId: Record<string, string> = {}
  const stagedTasks: Array<{
    task: OrchestrationTask
    dependsOnTitles: string[]
  }> = []

  for (const phase of config.phases) {
    for (const taskInput of phase.tasks) {
      const taskId = generateUUID()
      titleToId[taskInput.title] = taskId

      const task: OrchestrationTask = {
        task_id: taskId,
        event_id: eventId,
        title: taskInput.title,
        description: taskInput.description,
        phase: phase.id as OrchestrationPhaseId,
        status: 'locked', // Will be updated after dependency resolution
        assigned_role: taskInput.assigned_role as OrchestrationOperatorRole,
        depends_on: [], // Will be resolved in second pass
        deadline: taskInput.deadline ? new Date(taskInput.deadline).getTime() : undefined,
        priority: taskInput.priority,
        created_at: now,
      }

      stagedTasks.push({
        task,
        dependsOnTitles: taskInput.depends_on_titles || [],
      })
    }
  }

  // SECOND PASS: Resolve depends_on_titles to actual task_ids
  for (const staged of stagedTasks) {
    staged.task.depends_on = staged.dependsOnTitles
      .map((title) => titleToId[title])
      .filter(Boolean)

    // Set initial status based on dependencies
    if (staged.task.depends_on.length === 0) {
      staged.task.status = 'available'
    }
  }

  // Generate operator codes for each role
  const operators: OrchestrationOperator[] = []
  const roleLabels: Record<OrchestrationOperatorRole, string> = {
    director: 'Director',
    venue_lead: 'Venue Lead',
    sponsor_lead: 'Sponsor Lead',
    tech_lead: 'Tech Lead',
    volunteer_coord: 'Volunteer Coordinator',
    volunteer: 'Volunteer',
  }

  // Director always gets a code
  operators.push({
    operator_id: directorId,
    event_id: eventId,
    role: 'director',
    label: 'Director',
    scope: ['permissions', 'venue', 'sponsors', 'registrations', 'volunteers', 'gonogo'],
  })

  // Generate codes for other roles from config
  if (config.roles) {
    for (const roleConfig of config.roles) {
      if (roleConfig.role === 'director') continue // Already added

      const role = roleConfig.role as OrchestrationOperatorRole
      operators.push({
        operator_id: generateOperatorCode(role),
        event_id: eventId,
        role: role,
        label: roleConfig.label || roleLabels[role],
        scope: roleConfig.scope as OrchestrationPhaseId[],
      })
    }
  } else {
    // Default roles if not specified
    const defaultRoles: Array<{ role: OrchestrationOperatorRole; scope: OrchestrationPhaseId[] }> = [
      { role: 'venue_lead', scope: ['venue'] },
      { role: 'sponsor_lead', scope: ['sponsors'] },
      { role: 'tech_lead', scope: ['registrations'] },
      { role: 'volunteer_coord', scope: ['volunteers'] },
    ]

    for (const r of defaultRoles) {
      operators.push({
        operator_id: generateOperatorCode(r.role),
        event_id: eventId,
        role: r.role,
        label: roleLabels[r.role],
        scope: r.scope,
      })
    }
  }

  // Generate checkpoints for each phase
  const checkpoints: OrchestrationCheckpoint[] = config.phases.map((phase) => {
    const phaseTasks = stagedTasks.filter((st) => st.task.phase === phase.id)
    const criticalTaskIds = phaseTasks
      .filter((st) => st.task.priority === 'critical')
      .map((st) => st.task.task_id)

    return {
      checkpoint_id: generateUUID(),
      event_id: eventId,
      phase: phase.id as OrchestrationPhaseId,
      name: `${phase.label} Complete`,
      status: 'locked',
      required_task_ids: criticalTaskIds.length > 0 ? criticalTaskIds : phaseTasks.map((st) => st.task.task_id),
    }
  })

  // Build the full event
  const event: OrchestrationEvent = {
    event_id: eventId,
    name: config.name,
    description: '', // Will be set from original input
    date: new Date(config.date).getTime(),
    venue: config.venue || '',
    participant_count: config.participant_count || 0,
    status: 'active',
    created_at: now,
    updated_at: now,
    director_id: directorId,
    tasks: stagedTasks.map((st) => st.task),
    operators,
    checkpoints,
  }

  return event
}

// ============ Phase Labels ============

export const PHASE_LABELS: Record<OrchestrationPhaseId, string> = {
  permissions: 'Permissions & Approvals',
  venue: 'Venue & Logistics',
  sponsors: 'Sponsors & Funding',
  registrations: 'Registrations & Tech',
  volunteers: 'Volunteers & Teams',
  gonogo: 'Go / No-Go',
}

export const PHASE_ORDER: OrchestrationPhaseId[] = [
  'permissions',
  'venue',
  'sponsors',
  'registrations',
  'volunteers',
  'gonogo',
]
