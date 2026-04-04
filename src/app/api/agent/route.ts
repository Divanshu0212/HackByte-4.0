import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import type { LiveState, AgentResponse, RuleManifest } from '@/types'

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || ''
})

const PRIMARY_GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
const FALLBACK_GROQ_MODEL = 'llama-3.1-8b-instant'

function buildSystemPrompt(
  liveState: LiveState,
  ruleManifest: RuleManifest | null,
  conversationHistory: string[]
): string {
  const basePrompt = `You are the Elixa mid-event agent. You handle voice commands that the pattern matcher couldn't process.

## CURRENT LIVE STATE
${JSON.stringify(liveState, null, 2)}

${ruleManifest ? `## COMPILED RULE MANIFEST\n${JSON.stringify(ruleManifest, null, 2)}` : '## SCORING MODE: Linear (no rule manifest)'}

${conversationHistory.length > 0 ? `## CONVERSATION HISTORY\n${conversationHistory.slice(-5).join('\n')}` : ''}

## YOUR TASK
1. Interpret the operator's voice command
2. Determine the appropriate actions
3. Return a JSON response with your reasoning and actions

## RESPONSE FORMAT (strict JSON)
{
  "thought": "Your reasoning about the command",
  "observation": "What you notice in the current state",
  "actions": [
    // Array of action objects - see ACTION SCHEMA
  ],
  "commentary": "Optional energetic commentary for voice output",
  "proposal": {
    // Optional - only for complex changes requiring confirmation
    "type": "proposal",
    "confirmation_title": "Short title",
    "changes": ["What will change"],
    "untouched": ["What stays the same"],
    "effective_from": "now"
  }
}

## ACTION SCHEMA
Each action in the "actions" array must be one of:
- {"action": "add_participants", "teams": [{"name": "...", "score": 0}]}
- {"action": "add_participants", "count": N}
- {"action": "update_score", "id": "team_id", "delta": number, "reason": "..."}
- {"action": "set_score", "id": "team_id", "score": number, "reason": "..."}
- {"action": "rename_team", "id": "team_id", "new_name": "..."}
- {"action": "timer", "state": "start|stop|pause|reset", "duration": seconds}
- {"action": "change_mode", "mode": "numeric|goal_based|pass_fail"}
- {"action": "start_round", "round": number}
- {"action": "end_round"}
- {"action": "freeze_team", "id": "team_id", "until": "end_of_round|indefinite"}
- {"action": "thaw_team", "id": "team_id"}
- {"action": "eliminate_team", "id": "team_id"}
- {"action": "disqualify_team", "id": "team_id"}
- {"action": "revive_team", "id": "team_id"}
- {"action": "set_team_field", "id": "team_id", "field": "...", "value": ...}
- {"action": "undo"}
- {"action": "redo"}

## RULES
1. ALWAYS use team IDs from the current state, not display names
2. Score changes go forward only - never modify past data without explicit correction
3. For complex changes, include a "proposal" object for confirmation
4. Output ONLY valid JSON - no markdown, no explanation`

  return basePrompt
}

export async function POST(request: Request) {
  try {
    const { command, liveState, ruleManifest, conversationHistory } = await request.json()

    if (!command || !liveState) {
      return NextResponse.json(
        { success: false, error: 'Command and live state are required' },
        { status: 400 }
      )
    }

    if (!process.env.GROQ_API_KEY) {
       return NextResponse.json(
        { success: false, error: 'GROQ_API_KEY environment variable is not set.' },
        { status: 500 }
      )
    }

    const systemPrompt = buildSystemPrompt(
      liveState,
      ruleManifest || null,
      conversationHistory || []
    )

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: `Operator voice command: "${command}"\n\nReturn JSON response:` }
    ]

    let chatCompletion

    try {
      chatCompletion = await groq.chat.completions.create({
        messages,
        model: PRIMARY_GROQ_MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' }
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const isModelError = /model_decommissioned|decommissioned|not supported/i.test(errorMessage)

      if (!isModelError || PRIMARY_GROQ_MODEL === FALLBACK_GROQ_MODEL) {
        throw error
      }

      chatCompletion = await groq.chat.completions.create({
        messages,
        model: FALLBACK_GROQ_MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' }
      })
    }

    const responseText = chatCompletion.choices[0]?.message?.content || '{}'
    let response: AgentResponse

    try {
      response = JSON.parse(responseText)
    } catch (parseError) {
      console.error('Failed to parse agent response:', responseText)
      throw new Error('Failed to parse agent response')
    }

    // Ensure actions is an array
    if (!Array.isArray(response.actions)) {
      response.actions = []
    }

    return NextResponse.json({
      success: true,
      data: { response },
    })
  } catch (error) {
    console.error('Agent error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Agent processing failed',
      },
      { status: 500 }
    )
  }
}
