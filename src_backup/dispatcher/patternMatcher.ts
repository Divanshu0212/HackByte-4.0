/**
 * Pattern Matcher for Voice Commands
 *
 * Handles common voice commands locally without LLM call for faster response.
 * Based on the README pattern registry.
 */

import type { VoiceAction, LiveState } from '../types';
import { resolveParticipantId } from './applyVoiceActions';

export interface PatternMatch {
  matched: true;
  actions: VoiceAction[];
  commentary?: string;
}

export interface NoMatch {
  matched: false;
}

export type PatternResult = PatternMatch | NoMatch;

// Number word to digit mapping
const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  'twenty-one': 21, 'twenty-two': 22, 'twenty-three': 23, 'twenty-four': 24, 'twenty-five': 25,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};

function parseNumber(str: string): number | null {
  const cleaned = str.toLowerCase().trim();

  // Try direct number parse
  const num = parseInt(cleaned, 10);
  if (!isNaN(num)) return num;

  // Try word lookup
  if (NUMBER_WORDS[cleaned] !== undefined) {
    return NUMBER_WORDS[cleaned];
  }

  return null;
}

function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Try to match a voice command against known patterns.
 * Returns actions if matched, otherwise null to fall through to LLM.
 */
export function matchPattern(transcript: string, state: LiveState): PatternResult {
  const text = normalizeText(transcript);

  // ===== ADD TEAMS =====
  // "add 5 teams", "create 10 participants", "add five teams"
  const addTeamsMatch = text.match(/^(?:add|create)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+(?:teams?|participants?)$/i);
  if (addTeamsMatch) {
    const count = parseNumber(addTeamsMatch[1]);
    if (count && count > 0 && count <= 100) {
      return {
        matched: true,
        actions: [{ action: 'add_participants', teams: Array.from({ length: count }, (_, i) => ({ name: `Team ${state.participants.length + i + 1}`, score: 0 })) }],
        commentary: `Adding ${count} new teams to the competition!`,
      };
    }
  }

  // ===== SCORE UPDATES =====
  // "team X plus N", "team X minus N", "team X add N", "team X subtract N"
  const scoreMatch = text.match(/^(?:team\s+)?(.+?)\s+(?:plus|add|\+)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)$/i) ||
                     text.match(/^(?:add|give)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:points?\s+)?(?:to\s+)?(?:team\s+)?(.+)$/i);
  if (scoreMatch) {
    const [, teamOrPoints, pointsOrTeam] = scoreMatch;
    // Determine which capture is team and which is points based on pattern
    const isFirstPattern = text.includes('plus') || text.includes('add ') && !text.startsWith('add');
    const teamName = isFirstPattern ? teamOrPoints : pointsOrTeam;
    const points = parseNumber(isFirstPattern ? pointsOrTeam : teamOrPoints);

    if (points !== null && teamName) {
      const resolvedId = resolveParticipantId(state, teamName.trim());
      if (resolvedId) {
        const team = state.participants.find(p => p.id === resolvedId);
        return {
          matched: true,
          actions: [{ action: 'update_score', id: resolvedId, delta: points }],
          commentary: team ? `${team.name} scores ${points} points!` : undefined,
        };
      }
    }
  }

  // Minus/subtract pattern
  const minusMatch = text.match(/^(?:team\s+)?(.+?)\s+(?:minus|subtract|-)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)$/i) ||
                     text.match(/^(?:subtract|remove|deduct)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:points?\s+)?(?:from\s+)?(?:team\s+)?(.+)$/i);
  if (minusMatch) {
    const [, teamOrPoints, pointsOrTeam] = minusMatch;
    const isFirstPattern = text.includes('minus') || text.includes('subtract ') && !text.startsWith('subtract');
    const teamName = isFirstPattern ? teamOrPoints : pointsOrTeam;
    const points = parseNumber(isFirstPattern ? pointsOrTeam : teamOrPoints);

    if (points !== null && teamName) {
      const resolvedId = resolveParticipantId(state, teamName.trim());
      if (resolvedId) {
        const team = state.participants.find(p => p.id === resolvedId);
        return {
          matched: true,
          actions: [{ action: 'update_score', id: resolvedId, delta: -points }],
          commentary: team ? `${team.name} loses ${points} points.` : undefined,
        };
      }
    }
  }

  // "team X correct" / "team X wrong"
  const correctMatch = text.match(/^(?:team\s+)?(.+?)\s+(?:correct|right|got it)$/i);
  if (correctMatch) {
    const teamName = correctMatch[1];
    const resolvedId = resolveParticipantId(state, teamName.trim());
    if (resolvedId) {
      const team = state.participants.find(p => p.id === resolvedId);
      return {
        matched: true,
        actions: [{ action: 'update_score', id: resolvedId, delta: 10 }],
        commentary: team ? `Correct! ${team.name} earns 10 points!` : undefined,
      };
    }
  }

  const wrongMatch = text.match(/^(?:team\s+)?(.+?)\s+(?:wrong|incorrect|missed it)$/i);
  if (wrongMatch) {
    const teamName = wrongMatch[1];
    const resolvedId = resolveParticipantId(state, teamName.trim());
    if (resolvedId) {
      const team = state.participants.find(p => p.id === resolvedId);
      return {
        matched: true,
        actions: [{ action: 'update_score', id: resolvedId, delta: -5 }],
        commentary: team ? `Wrong answer. ${team.name} loses 5 points.` : undefined,
      };
    }
  }

  // ===== TIMER COMMANDS =====
  // "start timer N minutes/seconds", "stop timer", "pause timer", "reset timer"
  const timerStartMatch = text.match(/^start\s+(?:the\s+)?timer\s+(?:for\s+)?(\d+)\s*(minutes?|seconds?|mins?|secs?)?$/i);
  if (timerStartMatch) {
    const value = parseInt(timerStartMatch[1], 10);
    const unit = timerStartMatch[2]?.toLowerCase() || 'seconds';
    const seconds = unit.startsWith('min') ? value * 60 : value;
    return {
      matched: true,
      actions: [{ action: 'timer', state: 'start', duration: seconds }],
      commentary: `Timer started for ${value} ${unit}!`,
    };
  }

  if (/^(?:stop|end)\s+(?:the\s+)?timer$/i.test(text)) {
    return {
      matched: true,
      actions: [{ action: 'timer', state: 'stop' }],
      commentary: 'Timer stopped!',
    };
  }

  if (/^pause\s+(?:the\s+)?timer$/i.test(text)) {
    return {
      matched: true,
      actions: [{ action: 'timer', state: 'pause' }],
      commentary: 'Timer paused.',
    };
  }

  if (/^(?:reset|restart)\s+(?:the\s+)?timer$/i.test(text)) {
    return {
      matched: true,
      actions: [{ action: 'timer', state: 'reset' }],
      commentary: 'Timer reset.',
    };
  }

  // ===== ROUND COMMANDS =====
  // "start round N", "end round", "next round"
  const startRoundMatch = text.match(/^start\s+round\s+(\d+)$/i);
  if (startRoundMatch) {
    const roundNum = parseInt(startRoundMatch[1], 10);
    return {
      matched: true,
      actions: [{ action: 'set_live_field', field: 'round', value: roundNum }],
      commentary: `Round ${roundNum} begins!`,
    };
  }

  if (/^(?:end\s+round|finish\s+round|round\s+over)$/i.test(text)) {
    return {
      matched: true,
      actions: [{ action: 'end_round' }],
      commentary: `Round ${state.round} complete!`,
    };
  }

  if (/^(?:next\s+round|advance\s+round)$/i.test(text)) {
    return {
      matched: true,
      actions: [{ action: 'end_round' }],
      commentary: `Moving to round ${state.round + 1}!`,
    };
  }

  // ===== UNDO/REDO =====
  if (/^(?:undo|undo\s+last|go\s+back|undo\s+last\s+action)$/i.test(text)) {
    return {
      matched: true,
      actions: [{ action: 'undo' }],
      commentary: 'Undoing last action.',
    };
  }

  if (/^(?:redo|redo\s+last|redo\s+action)$/i.test(text)) {
    return {
      matched: true,
      actions: [{ action: 'redo' }],
      commentary: 'Redoing action.',
    };
  }

  // ===== ELIMINATE/REMOVE =====
  const eliminateMatch = text.match(/^(?:eliminate|remove|kick|disqualify)\s+(?:team\s+)?(.+)$/i);
  if (eliminateMatch) {
    const teamName = eliminateMatch[1];
    const resolvedId = resolveParticipantId(state, teamName.trim());
    if (resolvedId) {
      return {
        matched: true,
        actions: [{ action: 'set_participant_field', id: resolvedId, field: 'status', value: 'defeated' }],
        commentary: `Team eliminated from the competition.`,
      };
    }
  }

  // ===== NO MATCH - Fall through to LLM =====
  return { matched: false };
}
