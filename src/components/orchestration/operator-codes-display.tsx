'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, Shield, Building2, Banknote, ClipboardCheck, Users, User } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { OrchestrationOperatorRole, OrchestrationPhaseId } from '@/types'

interface OperatorCode {
  operator_id: string
  role: OrchestrationOperatorRole
  label: string
  scope: OrchestrationPhaseId[]
}

interface OperatorCodesDisplayProps {
  operators: OperatorCode[]
  eventId: string
  eventName: string
}

const roleIcons: Record<OrchestrationOperatorRole, React.ComponentType<{ className?: string }>> = {
  director: Shield,
  venue_lead: Building2,
  sponsor_lead: Banknote,
  tech_lead: ClipboardCheck,
  volunteer_coord: Users,
  volunteer: User,
}

const roleColors: Record<OrchestrationOperatorRole, string> = {
  director: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  venue_lead: 'bg-violet-500/20 text-purple-300 border-violet-500/30',
  sponsor_lead: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  tech_lead: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  volunteer_coord: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  volunteer: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
}

export function OperatorCodesDisplay({
  operators,
  eventId,
  eventName,
}: OperatorCodesDisplayProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyToClipboard = async (text: string, operatorId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(operatorId)
      toast.success('Copied to clipboard!')
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  const copyAllCodes = async () => {
    const text = operators
      .map((op) => `${op.label}: ${op.operator_id}`)
      .join('\n')
    const fullText = `${eventName} - Operator Codes\nEvent ID: ${eventId}\n\n${text}`

    try {
      await navigator.clipboard.writeText(fullText)
      toast.success('All codes copied!')
    } catch {
      toast.error('Failed to copy')
    }
  }

  return (
    <Card className="border-white/15 bg-[#1a1528]/60 backdrop-blur-md">
      <CardHeader className="border-b border-white/10 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-white">Operator Access Codes</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={copyAllCodes}
            className="border-white/20 text-slate-300 hover:bg-white/10"
          >
            <Copy className="h-3 w-3 mr-1" />
            Copy All
          </Button>
        </div>
        <p className="text-sm text-slate-400 mt-1">
          Share these codes with your team members. Each code grants access to specific phases.
        </p>
      </CardHeader>

      <CardContent className="p-4">
        <div className="space-y-3">
          {operators.map((operator, index) => {
            const Icon = roleIcons[operator.role]
            const isCopied = copiedId === operator.operator_id

            return (
              <motion.div
                key={operator.operator_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-center justify-between rounded-lg border p-3 ${roleColors[operator.role]}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{operator.label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="rounded bg-black/30 px-2 py-0.5 text-sm font-mono">
                        {operator.operator_id}
                      </code>
                      {operator.scope.length < 6 && (
                        <span className="text-xs opacity-70">
                          ({operator.scope.length} phase{operator.scope.length !== 1 ? 's' : ''})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(operator.operator_id, operator.operator_id)}
                  className="hover:bg-white/10"
                >
                  {isCopied ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </motion.div>
            )
          })}
        </div>

        {/* Event ID Section */}
        <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Event ID</p>
              <code className="text-sm font-mono text-purple-300">{eventId}</code>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyToClipboard(eventId, 'event-id')}
              className="text-slate-400 hover:text-slate-300"
            >
              {copiedId === 'event-id' ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Share Links */}
        <div className="mt-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-500">Quick Links</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const url = `${window.location.origin}/event-orchestration/dashboard/${eventId}`
                copyToClipboard(url, 'dashboard-link')
              }}
              className="border-white/20 text-slate-300 hover:bg-white/10"
            >
              {copiedId === 'dashboard-link' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
              Dashboard Link
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const url = `${window.location.origin}/event-orchestration/volunteer/${eventId}`
                copyToClipboard(url, 'volunteer-link')
              }}
              className="border-white/20 text-slate-300 hover:bg-white/10"
            >
              {copiedId === 'volunteer-link' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
              Volunteer Link
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
