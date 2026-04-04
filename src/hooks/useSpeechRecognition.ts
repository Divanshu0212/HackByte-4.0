'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

type Status = 'idle' | 'listening' | 'error'

export function useSpeechRecognition(onTranscript: (text: string) => void) {
  const [status, setStatus] = useState<Status>('idle')
  const [lastError, setLastError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const callbackRef = useRef(onTranscript)
  const shouldListenRef = useRef(false)

  callbackRef.current = onTranscript

  useEffect(() => {
    if (typeof window === 'undefined') return

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setLastError('Speech recognition not supported in this browser')
      return
    }

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognition.maxAlternatives = 1

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const last = event.results[event.results.length - 1]
      if (last.isFinal) {
        const transcript = last[0].transcript.trim()
        if (transcript) {
          callbackRef.current(transcript)
        }
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return
      console.error('[Speech] Error:', event.error)
      setLastError(`Speech error: ${event.error}`)
      if (event.error === 'not-allowed') {
        setStatus('error')
        shouldListenRef.current = false
      }
    }

    recognition.onend = () => {
      if (shouldListenRef.current) {
        try {
          recognition.start()
        } catch (e) {
          console.error('[Speech] Restart failed:', e)
          setStatus('idle')
          shouldListenRef.current = false
        }
      } else {
        setStatus('idle')
      }
    }

    recognitionRef.current = recognition

    return () => {
      shouldListenRef.current = false
      recognition.abort()
    }
  }, [])

  const start = useCallback(() => {
    const r = recognitionRef.current
    if (!r) {
      setLastError('Speech recognition not available')
      return
    }
    setLastError(null)
    shouldListenRef.current = true
    try {
      r.start()
      setStatus('listening')
    } catch (e) {
      // Already started — ignore
      setStatus('listening')
    }
  }, [])

  const stop = useCallback(() => {
    shouldListenRef.current = false
    recognitionRef.current?.stop()
    setStatus('idle')
  }, [])

  return { status, lastError, start, stop, isListening: status === 'listening' }
}
