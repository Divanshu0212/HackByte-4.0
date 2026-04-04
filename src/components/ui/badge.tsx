import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 glass-badge',
  {
    variants: {
      variant: {
        default:
          'glass-badge text-primary-foreground',
        secondary:
          'glass-surface text-secondary-foreground',
        destructive:
          'border-transparent bg-destructive/20 text-destructive-foreground glass-badge',
        success:
          'glass-badge-success text-success-foreground',
        warning:
          'glass-badge-warning text-warning-foreground',
        outline: 'text-foreground glass-surface',
        frozen: 'border-blue-300/40 glass-surface text-blue-300',
        shielded: 'border-blue-400/40 glass-surface text-blue-300',
        cursed: 'border-purple-400/40 glass-surface text-purple-300',
        momentum: 'border-amber-400/40 glass-surface text-amber-300',
        token: 'border-slate-300/40 glass-surface text-slate-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
