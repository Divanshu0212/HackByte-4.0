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

function parsePositiveInt(str: string): number | null {
  const parsed = parseNumber(str)
  if (parsed === null) return null
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.floor(parsed)
}

function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ')
}

/** Fuzzy team name matching with Levenshtein distance */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

function resolveTeamId(state: LiveState, input: string): Team | null {
  const normalized = normalizeText(input)

  // Try exact ID match
  const byId = state.teams.find(t => t.id === input)
  if (byId) return byId

  // Try exact name match
  const byName = state.teams.find(t => normalizeText(t.name) === normalized)
  if (byName) return byName

  // Try partial name match (contains)
  const byPartial = state.teams.find(t =>
    normalizeText(t.name).includes(normalized) ||
    normalized.includes(normalizeText(t.name))
  )
  if (byPartial) return byPartial

  // Try team number (e.g., "team 1", "team 2")
  const teamNumMatch = normalized.match(/team\s*(\d+)/)
  if (teamNumMatch) {
    const num = parseInt(teamNumMatch[1], 10)
    // Try exact match first
    const byNumber = state.teams.find(t =>
      normalizeText(t.name) === `team ${num}`
    )
    if (byNumber) return byNumber
    // Try contains
    const byNumContain = state.teams.find(t =>
      normalizeText(t.name).includes(`team ${num}`)
    )
    if (byNumContain) return byNumContain
    // Try by index (1-based)
    if (num > 0 && num <= state.teams.length) {
      return state.teams[num - 1]
    }
  }

  // Fuzzy match — allow up to 2 character difference for short names, 3 for longer
  let bestMatch: Team | null = null
  let bestDistance = Infinity
  for (const team of state.teams) {
    const teamNorm = normalizeText(team.name)
    const distance = levenshteinDistance(normalized, teamNorm)
    const threshold = teamNorm.length <= 6 ? 2 : 3
    if (distance < bestDistance && distance <= threshold) {
      bestDistance = distance
      bestMatch = team
    }
  }
  if (bestMatch) return bestMatch

  return null
}

/**
 * Pattern matcher for common voice commands.
 * Handles commands locally without LLM call for fast response (<50ms).
 */
export function matchPattern(transcript: string, state: LiveState): PatternResult {
  const text = normalizeText(transcript)

  // ===== ADD TEAMS =====
  // "add 5 teams" / "create 3 teams" / "add teams alpha beta gamma"
  const addTeamsMatch = text.match(
    /^(?:add|create|make)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+(?:teams?|participants?|players?|groups?)$/
  )
  if (addTeamsMatch) {
    const count = parseNumber(addTeamsMatch[1])
    if (count && count > 0 && count <= 100) {
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

  // "add teams alpha, beta, gamma"
  const addNamedTeamsMatch = text.match(
    /^(?:add|create)\s+teams?\s+(.+)$/
  )
  if (addNamedTeamsMatch) {
    const names = addNamedTeamsMatch[1]
      .split(/[,;\sand]+/)
      .map(n => n.trim())
      .filter(n => n.length > 0 && !['and', 'or'].includes(n.toLowerCase()))
    if (names.length > 0) {
      return {
        matched: true,
        actions: [{ action: 'add_participants', teams: names.map(name => ({ name, score: 0 })) }],
        commentary: `Adding ${names.length} teams: ${names.join(', ')}!`,
      }
    }
  }

  // ===== TEAM CORRECT/WRONG =====
  const correctMatch = text.match(/^(?:team\s+)?(.+?)\s+(?:is\s+)?(?:correct|right|got it|wins?|scored?)$/i)
  if (correctMatch) {
    const team = resolveTeamId(state, correctMatch[1])
    if (team) {
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
      return {
        matched: true,
        actions: [{ action: 'update_score', id: team.id, delta: points }],
        commentary: `${team.name} scores ${points} points!`,
      }
    }
  }

  // "subtract/deduct N points from team X"
  const subtractFromMatch = text.match(/^(?:subtract|deduct|remove)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:points?\s+)?(?:from\s+)?(?:team\s+)?(.+)$/i)
  if (subtractFromMatch) {
    const points = parseNumber(subtractFromMatch[1])
    const team = resolveTeamId(state, subtractFromMatch[2])
    if (team && points !== null) {
      return {
        matched: true,
        actions: [{ action: 'update_score', id: team.id, delta: -points }],
        commentary: `${team.name} loses ${points} points.`,
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
  const setRoundsMatch = text.match(
    /^(?:set|change|update)\s+(?:the\s+)?(?:number\s+of\s+)?rounds?\s+(?:to\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)$/i
  )
  if (setRoundsMatch) {
    const totalRounds = parsePositiveInt(setRoundsMatch[1])
    if (totalRounds !== null) {
      return {
        matched: true,
        actions: [{ action: 'set_total_rounds', total_rounds: totalRounds }],
        commentary: `Total rounds updated to ${totalRounds}.`,
      }
    }
  }

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
    if (state.round >= state.total_rounds) {
      return {
        matched: true,
        actions: [{ action: 'end_round' }],
        commentary: `Final round ${state.total_rounds} will now close.`,
      }
    }

    return {
      matched: true,
      actions: [{ action: 'end_round' }],
      commentary: `Moving to round ${Math.min(state.round + 1, state.total_rounds)}!`,
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
        commentary: `${team.name} is now frozen! ❄️`,
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
        commentary: `${team.name} is back in action! 🔥`,
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

  // ===== REVIVE =====
  const reviveMatch = text.match(/^(?:revive|restore|bring back)\s+(?:team\s+)?(.+)$/i)
  if (reviveMatch) {
    const team = resolveTeamId(state, reviveMatch[1])
    if (team) {
      return {
        matched: true,
        actions: [{ action: 'revive_team', id: team.id }],
        commentary: `${team.name} is back in the game!`,
      }
    }
  }

  // ===== RENAME =====
  const renameMatch = text.match(/^rename\s+(?:team\s+)?(.+?)\s+to\s+(.+)$/i)
  if (renameMatch) {
    const team = resolveTeamId(state, renameMatch[1])
    const newName = renameMatch[2].trim()
    if (team && newName) {
      return {
        matched: true,
        actions: [{ action: 'rename_team', id: team.id, new_name: newName }],
        commentary: `${team.name} is now ${newName}!`,
      }
    }
  }

  // ===== ANNOUNCE =====
  const announceMatch = text.match(/^announce\s+(.+)$/i)
  if (announceMatch) {
    const message = announceMatch[1].trim()
    return {
      matched: true,
      actions: [{ action: 'create_announcement', message, voice: true }],
      commentary: message,
    }
  }

  // ===== CHECKPOINT (Scenario 2) =====
  const checkpointMatch = text.match(/^(.+?)\s+(?:reached|arrived at|completed)\s+(?:checkpoint|station|point)\s+(\d+)$/i)
  if (checkpointMatch) {
    const team = resolveTeamId(state, checkpointMatch[1])
    const checkpoint = parseInt(checkpointMatch[2], 10)
    if (team) {
      return {
        matched: true,
        actions: [{ action: 'record_checkpoint', team_id: team.id, checkpoint }],
        commentary: `${team.name} has reached checkpoint ${checkpoint}!`,
      }
    }
  }

  // ===== UNDO/REDO =====
  if (/^(?:undo|undo\s+last|go\s+back|undo\s+last\s+action)$/i.test(text)) {
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
  return { matched: false }
}
