import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getScoreHistory } from '@/lib/mongodb'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '')

export async function POST(request: Request) {
  try {
    const { eventId, eventName, teams, rounds } = await request.json()

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      )
    }

    // Fetch score history from MongoDB
    const scoreHistory = await getScoreHistory(eventId, 500)

    const model = genAI.getGenerativeModel({
      model: 'models/gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    })

    const prompt = `You are a sports / game commentator writing a post-event summary for "${eventName || 'Event'}".

## EVENT DATA
- Teams: ${JSON.stringify(teams?.map((t: { name: string; score: number; live_status: string }) => ({ name: t.name, score: t.score, status: t.live_status })))}
- Rounds completed: ${rounds || 'unknown'}
- Score history (last 500 events): ${JSON.stringify(scoreHistory.slice(0, 50))}

## OUTPUT FORMAT (strict JSON)
{
  "summary": "A 2-3 paragraph narrative summary of the event, written in engaging sports commentary style",
  "highlights": ["Array of 3-5 key moments or highlights from the event"],
  "statistics": {
    "total_score_changes": number,
    "highest_scorer": "team name",
    "biggest_lead_change": number,
    "total_rounds": number
  },
  "mvp": "Name of the MVP team with brief justification"
}

Write an engaging, vibrant summary. Reference specific teams and scores. Be energetic!`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    let summary
    try {
      summary = JSON.parse(responseText)
    } catch {
      summary = {
        summary: responseText,
        highlights: [],
        statistics: {},
        mvp: teams?.[0]?.name || 'Unknown',
      }
    }

    return NextResponse.json({
      success: true,
      data: summary,
    })
  } catch (error) {
    console.error('Summary error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Summary generation failed',
      },
      { status: 500 }
    )
  }
}
