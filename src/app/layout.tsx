import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import { AppTransitionShell } from '@/components/app-shell/app-transition-shell'
import './globals.css'

export const metadata: Metadata = {
  title: 'Elixa - AI-Powered Event Management',
  description: 'Real-time AI-assisted event management for live quizzes and games.',
  keywords: ['event management', 'quiz', 'scoreboard', 'voice control', 'AI'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <script async src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js"></script>
        <script async src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.halo.min.js"></script>
        <AppTransitionShell>{children}</AppTransitionShell>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'hsl(var(--card))',
              color: 'hsl(var(--card-foreground))',
              border: '1px solid hsl(var(--border))',
            },
          }}
        />
      </body>
    </html>
  )
}
