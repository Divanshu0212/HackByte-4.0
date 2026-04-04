import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { LiveState, AgentResponse, RuleManifest } from '@/types'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '')

function buildSystemPrompt(
  liveState: LiveState,
  ruleManifest: RuleManifest | null,
  conversationHistory: string[]
): string {
  const basePrompt = `You are the Elixa mid-event agent. You handle voice commands that the pattern matcher couldn't process.

## CURRENT LIVE STATE
${JSON.stringify(liveState, null, 2)}

${ruleManifest ? `## COMPILED RULE MANIFEST
${JSON.stringify(ruleManifest, null, 2)}` : '## SCORING MODE: Linear (no rule manifest)'}

${conversationHistory.length > 0 ? `## CONVERSATION HISTORY
${conversationHistory.slice(-5).join('\n')}` : ''}

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
    "effective_from": "now | end_of_round | specific_time",
    "action": { "reducer": "reducer_name", "params": {} }
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
- {"action": "apply_rule_mutation", "target_id": "id", "field": "...", "operation": "increment|decrement|set|toggle", "value": ...}
- {"action": "set_team_field", "id": "team_id", "field": "...", "value": ...}
- {"action": "set_global_field", "field": "...", "value": ...}
- {"action": "undo"}
- {"action": "redo"}
- {"action": "manual_correction", "team_id": "id", "new_score": number, "reason": "..."}

## RULES
1. ALWAYS use team IDs from the current state, not display names
2. Score changes go forward only - never modify past data without explicit correction
3. For complex changes, include a "proposal" object for confirmation
4. Include commentary for significant changes
5. Output ONLY valid JSON - no markdown, no explanation

IMPORTANT: Never return an empty actions array if the operator asked to change something. If unsure, ask for clarification in the commentary.`

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

    const model = genAI.getGenerativeModel({
      model: 'models/gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    })

    const systemPrompt = buildSystemPrompt(
      liveState,
      ruleManifest || null,
      conversationHistory || []
    )

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: `Operator voice command: "${command}"\n\nReturn JSON response:` },
    ])

    const responseText = result.response.text()
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
