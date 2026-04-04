import { createAvatar, Result } from '@dicebear/core'
import { shapes, bottts, identicon, initials } from '@dicebear/collection'

export type AvatarStyle = 'shapes' | 'bottts' | 'identicon' | 'initials'

const AVATAR_STYLES = {
  shapes,
  bottts,
  identicon,
  initials,
}

// Vibrant color palette for team avatars
const TEAM_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#84cc16', // Lime
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#a855f7', // Purple
]

export function getTeamColor(index: number): string {
  return TEAM_COLORS[index % TEAM_COLORS.length]
}

export function generateAvatar(
  seed: string,
  style: AvatarStyle = 'shapes',
  options?: {
    backgroundColor?: string
    size?: number
  }
): Result {
  const avatarStyle = AVATAR_STYLES[style]

  return createAvatar(avatarStyle, {
    seed,
    backgroundColor: options?.backgroundColor ? [options.backgroundColor.replace('#', '')] : undefined,
    size: options?.size ?? 64,
  })
}

export function getAvatarDataUri(
  seed: string,
  style: AvatarStyle = 'shapes',
  options?: {
    backgroundColor?: string
    size?: number
  }
): string {
  const avatar = generateAvatar(seed, style, options)
  return avatar.toDataUri()
}

export function getAvatarSvg(
  seed: string,
  style: AvatarStyle = 'shapes',
  options?: {
    backgroundColor?: string
    size?: number
  }
): string {
  const avatar = generateAvatar(seed, style, options)
  return avatar.toString()
}

/**
 * Generate a team avatar URL using DiceBear API (CDN)
 * Faster initial load as no client-side generation needed
 */
export function getAvatarUrl(
  seed: string,
  style: AvatarStyle = 'shapes',
  options?: {
    backgroundColor?: string
    size?: number
  }
): string {
  const baseUrl = 'https://api.dicebear.com/9.x'
  const params = new URLSearchParams()

  params.set('seed', seed)
  if (options?.size) params.set('size', String(options.size))
  if (options?.backgroundColor) {
    params.set('backgroundColor', options.backgroundColor.replace('#', ''))
  }

  return `${baseUrl}/${style}/svg?${params.toString()}`
}
