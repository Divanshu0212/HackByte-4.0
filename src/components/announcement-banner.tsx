'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Megaphone, X } from 'lucide-react'

interface AnnouncementBannerProps {
  message: string | null
  onDismiss: () => void
}

export function AnnouncementBanner({ message, onDismiss }: AnnouncementBannerProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (message) {
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
        setTimeout(onDismiss, 500)
      }, 6000)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
    }
  }, [message, onDismiss])

  return (
    <AnimatePresence>
      {visible && message && (
        <motion.div
          initial={{ opacity: 0, y: -100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -100 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed inset-x-0 top-20 z-[60] flex justify-center px-4"
        >
          <div className="relative max-w-2xl w-full rounded-2xl border-2 border-primary/20 bg-card/95 backdrop-blur-xl shadow-2xl shadow-primary/10 p-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0 p-3 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20">
                <Megaphone className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
                  Announcement
                </p>
                <p className="text-lg font-semibold leading-snug">
                  {message}
                </p>
              </div>
              <button
                onClick={() => {
                  setVisible(false)
                  setTimeout(onDismiss, 300)
                }}
                className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            {/* Auto-dismiss progress bar */}
            <motion.div
              className="absolute bottom-0 left-0 h-1 bg-primary/30 rounded-bl-2xl"
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 6, ease: 'linear' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
