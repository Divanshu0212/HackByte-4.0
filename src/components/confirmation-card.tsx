'use client'

import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AgentProposal } from '@/types'

interface ConfirmationCardProps {
  proposal: AgentProposal
  onConfirm: () => void
  onCancel: () => void
  isProcessing?: boolean
}

export function ConfirmationCard({
  proposal,
  onConfirm,
  onCancel,
  isProcessing = false,
}: ConfirmationCardProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        <Card className="confirmation-card">
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <AlertCircle className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">
                  {proposal.confirmation_title}
                </CardTitle>
                {proposal.type === 'proposal' && (
                  <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Effective: {proposal.effective_from}</span>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Changes */}
            {proposal.changes.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  What will change
                </h4>
                <ul className="space-y-1.5">
                  {proposal.changes.map((change, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-start gap-2 text-sm"
                    >
                      <ArrowRight className="w-4 h-4 text-success shrink-0 mt-0.5" />
                      <span>{change}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}

            {/* Untouched */}
            {proposal.untouched.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-muted-foreground" />
                  Will not change
                </h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {proposal.untouched.map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Message */}
            {proposal.message && (
              <p className="text-sm text-muted-foreground italic border-l-2 border-muted pl-3">
                {proposal.message}
              </p>
            )}
          </CardContent>

          <CardFooter className="gap-2">
            <Button
              onClick={onConfirm}
              disabled={isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirm
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isProcessing}
            >
              Cancel
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </AnimatePresence>
  )
}
