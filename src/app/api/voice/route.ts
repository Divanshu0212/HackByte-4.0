import { NextResponse } from 'next/server'

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech'
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM' // Rachel - default voice

export async function POST(request: Request) {
  try {
    const { text, voiceId } = await request.json()

    if (!text) {
      return NextResponse.json(
        { success: false, error: 'Text is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      // Fallback: Return success but indicate no audio (client should use Web Speech API)
      return NextResponse.json({
        success: true,
        data: { fallback: true, text },
      })
    }

    const selectedVoiceId = voiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID

    const response = await fetch(`${ELEVENLABS_API_URL}/${selectedVoiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.5,
          use_speaker_boost: true,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ElevenLabs API error:', errorText)
      // Fallback to client-side TTS
      return NextResponse.json({
        success: true,
        data: { fallback: true, text },
      })
    }

    // Return audio as base64
    const audioBuffer = await response.arrayBuffer()
    const base64Audio = Buffer.from(audioBuffer).toString('base64')

    return NextResponse.json({
      success: true,
      data: {
        audio: base64Audio,
        contentType: 'audio/mpeg',
      },
    })
  } catch (error) {
    console.error('Voice synthesis error:', error)
    // Fallback to client-side TTS on any error
    return NextResponse.json({
      success: true,
      data: { fallback: true },
    })
  }
}
