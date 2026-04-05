/**
 * Voice Announcements Utility
 * Supports ElevenLabs TTS with browser SpeechSynthesis fallback
 */

// ElevenLabs configuration
const ELEVENLABS_API_KEY = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || ''
const ELEVENLABS_VOICE_ID = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL' // Sarah voice (default)
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech'

interface SpeakOptions {
  voice?: 'elevenlabs' | 'browser'
  rate?: number // 0.5 to 2.0
  pitch?: number // 0.5 to 2.0
  volume?: number // 0 to 1
  onStart?: () => void
  onEnd?: () => void
  onError?: (error: Error) => void
}

/**
 * Speak text using ElevenLabs TTS or browser fallback
 */
export async function speak(text: string, options: SpeakOptions = {}): Promise<void> {
  const { voice = 'browser', onStart, onEnd, onError } = options

  // Try ElevenLabs first if API key is available
  if (voice === 'elevenlabs' && ELEVENLABS_API_KEY) {
    try {
      await speakWithElevenLabs(text, options)
      return
    } catch (error) {
      console.warn('ElevenLabs TTS failed, falling back to browser:', error)
      // Fall through to browser TTS
    }
  }

  // Browser SpeechSynthesis fallback
  await speakWithBrowser(text, options)
}

/**
 * Speak using ElevenLabs Turbo v2
 */
async function speakWithElevenLabs(text: string, options: SpeakOptions): Promise<void> {
  const { onStart, onEnd, onError } = options

  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/${ELEVENLABS_VOICE_ID}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
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
      throw new Error(`ElevenLabs API error: ${response.status}`)
    }

    const audioBlob = await response.blob()
    const audioUrl = URL.createObjectURL(audioBlob)
    const audio = new Audio(audioUrl)

    return new Promise((resolve, reject) => {
      audio.onplay = () => onStart?.()
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
        onEnd?.()
        resolve()
      }
      audio.onerror = (e) => {
        const error = new Error('Audio playback failed')
        onError?.(error)
        reject(error)
      }
      audio.play().catch(reject)
    })
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error('ElevenLabs TTS failed'))
    throw error
  }
}

/**
 * Speak using browser SpeechSynthesis
 */
async function speakWithBrowser(text: string, options: SpeakOptions): Promise<void> {
  const { rate = 0.9, pitch = 1, volume = 1, onStart, onEnd, onError } = options

  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      const error = new Error('Speech synthesis not supported')
      onError?.(error)
      reject(error)
      return
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = rate
    utterance.pitch = pitch
    utterance.volume = volume

    // Try to get a good voice
    const voices = window.speechSynthesis.getVoices()
    const preferredVoice = voices.find(
      (v) => v.name.includes('Google') || v.name.includes('Microsoft') || v.lang.startsWith('en')
    )
    if (preferredVoice) {
      utterance.voice = preferredVoice
    }

    utterance.onstart = () => onStart?.()
    utterance.onend = () => {
      onEnd?.()
      resolve()
    }
    utterance.onerror = (e) => {
      // "interrupted" and "canceled" are not real errors - they happen when speech is cancelled
      if (e.error === 'interrupted' || e.error === 'canceled') {
        resolve() // Resolve gracefully instead of rejecting
        return
      }
      const error = new Error(`Speech synthesis error: ${e.error}`)
      onError?.(error)
      reject(error)
    }

    window.speechSynthesis.speak(utterance)
  })
}

/**
 * Pre-built announcement messages for checkpoints
 */
export const CHECKPOINT_ANNOUNCEMENTS = {
  permissions: (eventName: string) =>
    `Permissions checkpoint passed. ${eventName} has received all necessary approvals.`,
  venue: (eventName: string) =>
    `Venue checkpoint passed. The location for ${eventName} is now confirmed and secured.`,
  sponsors: (eventName: string) =>
    `Sponsors checkpoint passed. Funding for ${eventName} is in place.`,
  registrations: (eventName: string) =>
    `Registrations checkpoint passed. ${eventName} participant signups are on track.`,
  volunteers: (eventName: string) =>
    `Volunteers checkpoint passed. The ${eventName} team is ready.`,
  gonogo: (eventName: string) =>
    `All systems confirmed. ${eventName} is ready to launch!`,
} as const

/**
 * Announce a checkpoint pass with voice
 */
export async function announceCheckpointPassed(
  phase: keyof typeof CHECKPOINT_ANNOUNCEMENTS,
  eventName: string,
  options?: SpeakOptions
): Promise<void> {
  const message = CHECKPOINT_ANNOUNCEMENTS[phase](eventName)
  await speak(message, { voice: 'browser', ...options })
}

/**
 * Announce a custom message (for director broadcasts)
 */
export async function announceMessage(
  message: string,
  options?: SpeakOptions
): Promise<void> {
  await speak(message, { voice: 'browser', ...options })
}

/**
 * Check if voice is available
 */
export function isVoiceAvailable(): boolean {
  return 'speechSynthesis' in window || !!ELEVENLABS_API_KEY
}

/**
 * Get available voices (browser only)
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) return []
  return window.speechSynthesis.getVoices()
}
