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
      <body className="font-sans antialiased min-h-screen relative">
        {/* Floating glassy background elements */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          {/* Animated glassy orbs */}
          <div className="absolute top-1/4 left-1/4 w-64 h-64 glass-animated">
            <div className="w-full h-full rounded-full glass-overlay opacity-20"></div>
          </div>
          <div className="absolute bottom-1/3 right-1/4 w-48 h-48 glass-animated" style={{ animationDelay: '2s' }}>
            <div className="w-full h-full rounded-full glass-overlay opacity-15"></div>
          </div>
          <div className="absolute top-1/2 right-1/3 w-32 h-32 glass-animated" style={{ animationDelay: '4s' }}>
            <div className="w-full h-full rounded-full glass-overlay opacity-25"></div>
          </div>
          
          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/5 via-transparent to-blue-900/5"></div>
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
        </div>
        
        <script async src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js"></script>
        <script async src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.waves.min.js"></script>
        <script async src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.halo.min.js"></script>
        
        <div className="relative z-10">
          <AppTransitionShell>{children}</AppTransitionShell>
        </div>
        
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: 'glass-card',
            style: {
              background: 'rgba(26, 21, 40, 0.8)',
              color: 'hsl(var(--card-foreground))',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(12px)',
            },
          }}
        />
      </body>
    </html>
  )
}
