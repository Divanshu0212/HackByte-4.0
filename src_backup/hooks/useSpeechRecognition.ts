import { useCallback, useEffect, useRef, useState } from 'react';

export type SpeechRecState = 'idle' | 'listening' | 'error';

/** Minimal typing for browser Speech Recognition */
interface SpeechRec extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((ev: Event) => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: Event) => void) | null;
}

interface SpeechRecConstructor {
  new (): SpeechRec;
}

function getSpeechRecognitionCtor(): SpeechRecConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecConstructor;
    webkitSpeechRecognition?: SpeechRecConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/**
 * Continuous listening: continuous=true, interimResults=false.
 * Recursive restart on onend/onerror (Section 1.1).
 */
export function useSpeechRecognition(onFinal: (transcript: string) => void) {
  const [status, setStatus] = useState<SpeechRecState>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const stop = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    setStatus('idle');
  }, []);

  const start = useCallback(() => {
    const SR = getSpeechRecognitionCtor();
    if (!SR) {
      setLastError('SpeechRecognition not supported in this browser.');
      setStatus('error');
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';

    rec.onresult = (ev: Event) => {
      try {
        const r = ev as unknown as {
          resultIndex: number;
          results: { length: number; [i: number]: { [k: number]: { transcript: string } } };
        };
        const item = r.results[r.resultIndex];
        const text = item[0]?.transcript?.trim();
        if (text) onFinalRef.current(text);
      } catch (e) {
        console.error(e);
      }
    };

    const restart = () => {
      if (!recRef.current) return;
      try {
        rec.start();
      } catch {
        /* already started */
      }
    };

    rec.onend = () => {
      if (recRef.current === rec) restart();
    };

    rec.onerror = (ev: Event) => {
      const err = ev as unknown as { error?: string };
      setLastError(err.error || 'speech error');
      if (recRef.current === rec) restart();
    };

    recRef.current = rec;
    setStatus('listening');
    setLastError(null);
    try {
      rec.start();
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { status, lastError, start, stop };
}
