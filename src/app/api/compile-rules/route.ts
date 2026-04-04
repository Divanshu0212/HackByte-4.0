import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { RuleManifest } from '@/types'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '')

const SYSTEM_PROMPT = `You are a game rules compiler for Elixa, an AI-powered event management system.

Given a natural language description of a game's scoring logic, extract and output a strict JSON Rule Manifest.

The manifest MUST define:
- scoringType: "linear" | "non_linear"
- triggers: array of trigger objects, each containing:
    - phrase: regex-friendly description of the voice command pattern
    - conditions: optional preconditions (target, field, equals)
    - actions: ordered state mutations (target, field, operation, value)
- passiveEffects: optional effects triggered by state changes
- statusValues: all status values entities can hold (lowercase)
- tokens: available one-time tokens (e.g., "revive", "shield")
- modifiers: available score modifiers
- globalTriggers: triggers affecting global state
- chainReactions: automatic follow-up actions
- commentary_hints: mapping trigger phrases to commentary text
- rulesetLabel: short human-readable name

For complex games, include MANY specific triggers for:
- Combat/scoring actions
- Items/power-ups
- Phase changes
- Round-end hooks
- Special conditions

Output ONLY valid JSON. No markdown, no explanation.`

export async function POST(request: Request) {
  try {
    const { description } = await request.json()

    if (!description || typeof description !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Description is required' },
        { status: 400 }
      )
    }

    const model = genAI.getGenerativeModel({
      model: 'models/gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT,
    })

    const result = await model.generateContent(
      `Compile the following game rules into a JSON Rule Manifest:\n\n${description}`
    )

    const response = result.response
    const text = response.text()

    // Parse the JSON response
    let manifest: RuleManifest
    try {
      // Try to extract JSON from the response (in case there's any wrapping)
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }
      manifest = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error('Failed to parse manifest:', text)
      throw new Error('Failed to parse rule manifest from Gemini response')
    }

    // Validate required fields
    if (!manifest.scoringType || !manifest.triggers || !manifest.statusValues) {
      throw new Error('Invalid manifest: missing required fields')
    }

    return NextResponse.json({
      success: true,
      data: { manifest },
    })
  } catch (error) {
    console.error('Rule compilation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to compile rules',
      },
      { status: 500 }
    )
  }
}
