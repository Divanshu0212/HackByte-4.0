import type { LiveState, PatternResult, VoiceAction, Team } from '@/types'

// Number word to digit mapping
const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90, hundred: 100,
}

function parseNumber(str: string): number | null {
  const cleaned = str.toLowerCase().trim()
  const num = parseInt(cleaned, 10)
  if (!isNaN(num)) return num
  return NUMBER_WORDS[cleaned] ?? null
}

function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ')
}

function resolveTeamId(state: LiveState, input: string): Team | null {
  const normalized = normalizeText(input)

  // Try exact ID match
  const byId = state.teams.find(t => t.id === input)
  if (byId) return byId

  // Try exact name match
  const byName = state.teams.find(t => normalizeText(t.name) === normalized)
  if (byName) return byName

  // Try partial name match
  const byPartial = state.teams.find(t =>
    normalizeText(t.name).includes(normalized) ||
    normalized.includes(normalizeText(t.name))
  )
  if (byPartial) return byPartial

  // Try team number (e.g., "team 1", "team 2")
  const teamNumMatch = normalized.match(/team\s*(\d+)/)
  if (teamNumMatch) {
    const num = parseInt(teamNumMatch[1], 10)
    const byNumber = state.teams.find(t =>
      t.name.toLowerCase().includes(`team ${num}`) ||
      t.name.toLowerCase() === `team ${num}`
    )
    if (byNumber) return byNumber
  }

  return null
}

/**
 * Pattern matcher for common voice commands.
 * Handles commands locally without LLM call for fast response (<50ms).
 */
export function matchPattern(transcript: string, state: LiveState): PatternResult {
  const text = normalizeText(transcript)

  console.log('[Pattern Matcher] Trying to match:', text)

  // ===== ADD TEAMS =====
  const addTeamsMatch = text.match(
    /^(?:add|create|make)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+(?:teams?|participants?|players?|groups?)$/
  )
  if (addTeamsMatch) {
    const count = parseNumber(addTeamsMatch[1])
    if (count && count > 0 && count <= 100) {
      console.log('[Pattern Matcher] ✓ Matched ADD TEAMS:', count)
      const teams = Array.from({ length: count }, (_, i) => ({
        name: `Team ${state.teams.length + i + 1}`,
        score: 0,
      }))
      return {
        matched: true,
        actions: [{ action: 'add_participants', teams }],
        commentary: `Adding ${count} new teams to the competition!`,
      }
    }
  }

  // ===== TEAM CORRECT/WRONG =====
  const correctMatch = text.match(/^(?:team\s+)?(.+?)\s+(?:is\s+)?(?:correct|right|got it|wins?|scored?)$/i)
  if (correctMatch) {
    const team = resolveTeamId(state, correctMatch[1])
    if (team) {
      console.log('[Pattern Matcher] ✓ Matched CORRECT for', team.name)
      return {
        matched: true,
        actions: [{ action: 'update_score', id: team.id, delta: 10, reason: 'Correct answer' }],
        commentary: `Correct! ${team.name} earns 10 points!`,
      }
    }
  }

  const wrongMatch = text.match(/^(?:team\s+)?(.+?)\s+(?:is\s+)?(?:wrong|incorrect|missed|loses?|failed?)$/i)
  if (wrongMatch) {
    const team = resolveTeamId(state, wrongMatch[1])
    if (team) {
      console.log('[Pattern Matcher] ✓ Matched WRONG for', team.name)
      return {
        matched: true,
        actions: [{ action: 'update_score', id: team.id, delta: -5, reason: 'Wrong answer' }],
        commentary: `Wrong answer. ${team.name} loses 5 points.`,
      }
    }
  }

  // ===== SCORE UPDATES =====
  // "team X plus 5" or "team X add 10"
  const plusMatch = text.match(/^(?:team\s+)?(.+?)\s+(?:plus|\+|add|gets?)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|hundred)\s*(?:points?)?$/i)
  if (plusMatch) {
    const team = resolveTeamId(state, plusMatch[1])
    const points = parseNumber(plusMatch[2])
    if (team && points !== null) {
      console.log('[Pattern Matcher] ✓ Matched PLUS for', team.name, '+', points)
      return {
        matched: true,
        actions: [{ action: 'update_score', id: team.id, delta: points }],
        commentary: `${team.name} scores ${points} points!`,
      }
    }
  }

  const minusMatch = text.match(/^(?:team\s+)?(.+?)\s+(?:minus|-|subtract|lose[s]?)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty)\s*(?:points?)?$/i)
  if (minusMatch) {
    const team = resolveTeamId(state, minusMatch[1])
    const points = parseNumber(minusMatch[2])
    if (team && points !== null) {
      console.log('[Pattern Matcher] ✓ Matched MINUS for', team.name, '-', points)
      return {
        matched: true,
        actions: [{ action: 'update_score', id: team.id, delta: -points }],
        commentary: `${team.name} loses ${points} points.`,
      }
    }
  }

  // Alternative: "add N points to team X" or "give team X 10 points"
  const addToMatch = text.match(/^(?:add|give)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty)\s+(?:points?\s+)?(?:to\s+)?(?:team\s+)?(.+)$/i)
  if (addToMatch) {
    const points = parseNumber(addToMatch[1])
    const team = resolveTeamId(state, addToMatch[2])
    if (team && points !== null) {
      console.log('[Pattern Matcher] ✓ Matched ADD TO for', team.name, '+', points)
      return {
        matched: true,
        actions: [{ action: 'update_score', id: team.id, delta: points }],
        commentary: `${team.name} scores ${points} points!`,
      }
    }
  }

  // ===== TIMER COMMANDS =====
  const timerStartMatch = text.match(/^start\s+(?:the\s+)?timer\s+(?:for\s+)?(\d+)\s*(minutes?|seconds?|mins?|secs?)?$/i)
  if (timerStartMatch) {
    const value = parseInt(timerStartMatch[1], 10)
    const unit = timerStartMatch[2]?.toLowerCase() || 'seconds'
    const seconds = unit.startsWith('min') ? value * 60 : value
    return {
      matched: true,
      actions: [{ action: 'timer', state: 'start', duration: seconds }],
      commentary: `Timer started for ${value} ${unit}!`,
    }
  }

  if (/^(?:stop|end)\s+(?:the\s+)?timer$/i.test(text)) {
    return {
      matched: true,
      actions: [{ action: 'timer', state: 'stop' }],
      commentary: 'Timer stopped!',
    }
  }

  if (/^pause\s+(?:the\s+)?timer$/i.test(text)) {
    return {
      matched: true,
      actions: [{ action: 'timer', state: 'pause' }],
      commentary: 'Timer paused.',
    }
  }

  if (/^(?:reset|restart)\s+(?:the\s+)?timer$/i.test(text)) {
    return {
      matched: true,
      actions: [{ action: 'timer', state: 'reset' }],
      commentary: 'Timer reset.',
    }
  }

  // ===== ROUND COMMANDS =====
  const startRoundMatch = text.match(/^start\s+round\s+(\d+)$/i)
  if (startRoundMatch) {
    const round = parseInt(startRoundMatch[1], 10)
    return {
      matched: true,
      actions: [{ action: 'start_round', round }],
      commentary: `Round ${round} begins!`,
    }
  }

  if (/^(?:end\s+round|finish\s+round|round\s+over)$/i.test(text)) {
    return {
      matched: true,
      actions: [{ action: 'end_round' }],
      commentary: `Round ${state.round} complete!`,
    }
  }

  if (/^(?:next\s+round|advance\s+round)$/i.test(text)) {
    return {
      matched: true,
      actions: [{ action: 'end_round' }],
      commentary: `Moving to round ${state.round + 1}!`,
    }
  }

  // ===== FREEZE/THAW =====
  const freezeMatch = text.match(/^freeze\s+(?:team\s+)?(.+)$/i)
  if (freezeMatch) {
    const team = resolveTeamId(state, freezeMatch[1])
    if (team) {
      return {
        matched: true,
        actions: [{ action: 'freeze_team', id: team.id }],
        commentary: `${team.name} is now frozen!`,
      }
    }
  }

  const unfreezeMatch = text.match(/^(?:unfreeze|thaw)\s+(?:team\s+)?(.+)$/i)
  if (unfreezeMatch) {
    const team = resolveTeamId(state, unfreezeMatch[1])
    if (team) {
      return {
        matched: true,
        actions: [{ action: 'thaw_team', id: team.id }],
        commentary: `${team.name} is back in action!`,
      }
    }
  }

  // ===== ELIMINATE/DISQUALIFY =====
  const eliminateMatch = text.match(/^(?:eliminate|remove)\s+(?:team\s+)?(.+)$/i)
  if (eliminateMatch) {
    const team = resolveTeamId(state, eliminateMatch[1])
    if (team) {
      return {
        matched: true,
        actions: [{ action: 'eliminate_team', id: team.id }],
        commentary: `${team.name} has been eliminated!`,
      }
    }
  }

  const disqualifyMatch = text.match(/^disqualify\s+(?:team\s+)?(.+)$/i)
  if (disqualifyMatch) {
    const team = resolveTeamId(state, disqualifyMatch[1])
    if (team) {
      return {
        matched: true,
        actions: [{ action: 'disqualify_team', id: team.id }],
        commentary: `${team.name} has been disqualified!`,
      }
    }
  }

  // ===== UNDO/REDO =====
  if (/^(?:undo|undo\s+last|go\s+back)$/i.test(text)) {
    return {
      matched: true,
      actions: [{ action: 'undo' }],
      commentary: 'Undoing last action.',
    }
  }

  if (/^(?:redo|redo\s+last)$/i.test(text)) {
    return {
      matched: true,
      actions: [{ action: 'redo' }],
      commentary: 'Redoing action.',
    }
  }

  // ===== NO MATCH =====
  console.log('[Pattern Matcher] ✗ No match found, falling back to Gemini agent')
  return { matched: false }
}
