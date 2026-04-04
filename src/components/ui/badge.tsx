import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        success:
          'border-transparent bg-success text-success-foreground hover:bg-success/80',
        warning:
          'border-transparent bg-warning text-warning-foreground hover:bg-warning/80',
        outline: 'text-foreground',
        frozen: 'border-blue-300 bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
        shielded: 'border-blue-400 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300',
        cursed: 'border-purple-400 bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-300',
        momentum: 'border-amber-400 bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300',
        token: 'border-slate-300 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
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
