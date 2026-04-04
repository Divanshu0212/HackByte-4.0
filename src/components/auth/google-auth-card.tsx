'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { initializeApp, getApp, getApps } from 'firebase/app'
import {
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { ArrowRight, LogOut, Phone, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

function getFirebaseAuth() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
  return getAuth(app)
}

type GoogleAuthCardProps = {
  targetRoute: string
}

export function GoogleAuthCard({ targetRoute }: GoogleAuthCardProps) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isFirebaseConfigured = useMemo(() => {
    return Boolean(
      firebaseConfig.apiKey &&
        firebaseConfig.authDomain &&
        firebaseConfig.projectId &&
        firebaseConfig.appId
    )
  }, [])

  useEffect(() => {
    if (!isFirebaseConfigured) {
      return
    }

    const auth = getFirebaseAuth()
    const unsubscribe = onAuthStateChanged(auth, (activeUser) => {
      setUser(activeUser)
      if (activeUser?.uid) {
        const savedPhone = localStorage.getItem(`elixa:phone:${activeUser.uid}`) || ''
        setPhoneNumber(savedPhone)
      }
    })

    return () => unsubscribe()
  }, [isFirebaseConfigured])

  const handleGoogleSignIn = async () => {
    if (!isFirebaseConfigured) {
      return
    }

    try {
      setAuthLoading(true)
      setError('')
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      const auth = getFirebaseAuth()
      await signInWithPopup(auth, provider)
    } catch (signInError) {
      const message = signInError instanceof Error ? signInError.message : 'Google sign-in failed.'
      setError(message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignOut = async () => {
    if (!isFirebaseConfigured) {
      return
    }

    const auth = getFirebaseAuth()
    await signOut(auth)
    setPhoneNumber('')
  }

  const handleContinue = async () => {
    if (!user?.uid) {
      setError('Please sign in with Google before continuing.')
      return
    }

    const normalizedPhone = phoneNumber.trim()
    const phoneRegex = /^\+?[0-9\s()-]{8,20}$/
    if (!phoneRegex.test(normalizedPhone)) {
      setError('Enter a valid phone number including country code when possible.')
      return
    }

    try {
      setSubmitting(true)
      setError('')
      localStorage.setItem(`elixa:phone:${user.uid}`, normalizedPhone)
      localStorage.setItem(
        'elixa:activeProfile',
        JSON.stringify({
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'Operator',
          photoURL: user.photoURL || '',
          phoneNumber: normalizedPhone,
        })
      )
      router.push(targetRoute)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="glass-card border-white/20 text-slate-100">
      <CardHeader>
        <CardTitle className="text-2xl glass-text">Access Console</CardTitle>
        <CardDescription className="text-slate-300">
          Sign in or sign up with Google, then confirm your phone number to continue.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isFirebaseConfigured && (
          <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200 glass-surface">
            Firebase environment variables are missing. Add them in your local environment to enable Google login.
          </p>
        )}

        {user ? (
          <div className="rounded-lg glass-surface p-4">
            <p className="text-sm text-slate-300">Signed in as</p>
            <p className="font-semibold glass-text">{user.displayName || user.email}</p>
          </div>
        ) : (
          <Button
            className="w-full glass-bright-button"
            disabled={!isFirebaseConfigured || authLoading}
            onClick={handleGoogleSignIn}
            type="button"
          >
            {authLoading ? 'Connecting...' : 'Continue With Google'}
          </Button>
        )}

        <label className="block space-y-2 text-sm text-slate-200">
          <span className="inline-flex items-center gap-2 glass-text">
            <Phone className="h-4 w-4" />
            Phone Number
          </span>
          <input
            className="w-full rounded-md glass-input"
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="+91 98765 43210"
            type="tel"
            value={phoneNumber}
          />
        </label>

        <Button
          className="w-full gap-2 glass-bright-button"
          disabled={!user || submitting}
          onClick={handleContinue}
          type="button"
        >
          <ShieldCheck className="h-4 w-4" />
          {submitting ? 'Preparing Workspace...' : 'Enter Workspace'}
          <ArrowRight className="h-4 w-4" />
        </Button>

        {user && (
          <Button className="w-full gap-2 glass-button" onClick={handleSignOut} type="button" variant="outline">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        )}

        {error && <p className="text-sm text-red-300 glass-surface p-2 rounded border border-red-400/30">{error}</p>}
      </CardContent>
    </Card>
  )
}
