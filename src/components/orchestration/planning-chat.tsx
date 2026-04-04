'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from 'ai/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface PlanningChatProps {
  onConfigGenerated: (configJson: string) => void
}

export function PlanningChat({ onConfigGenerated }: PlanningChatProps) {
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { messages, isLoading, error, append } = useChat({
    api: '/api/orchestration/plan',
    onFinish: (message) => {
      // Check if the message contains valid JSON config
      try {
        const jsonMatch = message.content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          // Validate it's an event config by checking for required fields
          const parsed = JSON.parse(jsonMatch[0])
          if (parsed.name && parsed.phases && Array.isArray(parsed.phases)) {
            onConfigGenerated(message.content)
          }
        }
      } catch {
        // Not valid JSON, might be a clarifying question
      }
    },
  })

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isLoading) return

    const userMessage = inputValue.trim()
    setInputValue('')

    await append({
      role: 'user',
      content: userMessage,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const examplePrompts = [
    'HackByte 4.0, 24-hour hackathon, 200 participants, IIITDM Jabalpur, April 20. 5 volunteers.',
    'College annual fest, 3-day event, 500 expected attendees, need venue, sponsors, and volunteer coordination.',
    'Tech workshop series, 4 workshops over 2 weeks, 50 participants each, online registration.',
  ]

  return (
    <Card className="border-white/15 bg-[#1a1528]/60 backdrop-blur-md">
      <CardContent className="p-6">
        {/* Messages Area */}
        <div className="mb-4 max-h-[400px] min-h-[200px] overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-4">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-purple-200">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm font-medium">Describe your event</span>
              </div>
              <p className="text-sm text-slate-300">
                Tell me about the event you&apos;re organizing. Include details like the name, date,
                venue, expected participants, and what needs to be coordinated.
              </p>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-400">Example prompts:</p>
                {examplePrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => setInputValue(prompt)}
                    className="block w-full rounded-lg border border-white/10 bg-white/5 p-3 text-left text-sm text-slate-300 transition hover:border-violet-400/30 hover:bg-white/10"
                  >
                    &ldquo;{prompt}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-violet-500/20 text-purple-100'
                          : 'bg-white/10 text-slate-200'
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <div className="mb-1 flex items-center gap-1 text-xs text-purple-300">
                          <Sparkles className="h-3 w-3" />
                          Elixa
                        </div>
                      )}
                      <div className="whitespace-pre-wrap text-sm">
                        {message.content.includes('{') && message.content.includes('"phases"') ? (
                          <span className="font-mono text-emerald-300">
                            ✓ Event configuration generated
                          </span>
                        ) : (
                          message.content
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 text-purple-300"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Generating event structure...</span>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-300">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error.message}</span>
          </div>
        )}

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your event..."
            rows={2}
            className="flex-1 resize-none rounded-lg border border-white/15 bg-black/30 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-400/50 focus:outline-none focus:ring-1 focus:ring-violet-400/50"
            disabled={isLoading}
          />
          <Button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="self-end bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-600 hover:to-purple-600"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
