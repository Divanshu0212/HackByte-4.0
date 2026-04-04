import type { GroqAgentResponse, LiveState, Participant, VoiceAction } from '../types';
import type { StateCommand } from '../hooks/useUndoRedo';

const COLORS = [
  '#6366f1',
  '#ec4899',
  '#14b8a6',
  '#f59e0b',
  '#8b5cf6',
  '#06b6d4',
  '#ef4444',
  '#22c55e',
];

function slugId(name: string, existing: Set<string>): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 32) || 'team';
  let id = base;
  let n = 0;
  while (existing.has(id)) {
    n += 1;
    id = `${base}_${n}`;
  }
  return id;
}

function mapParticipants(
  state: LiveState,
  mapper: (list: Participant[]) => Participant[],
): LiveState {
  return { ...state, participants: mapper(state.participants) };
}

/** Normalize for loose name comparison */
function normNameKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * LLMs often put display names ("Team 4") in `id` instead of real ids ("team_4").
 * Resolve to canonical participant id from CURRENT state at apply time.
 */
function nameToSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 32) || 'team'
  );
}

export function resolveParticipantId(s: LiveState, raw: string): string | null {
  const t = raw?.trim();
  if (!t) return null;
  const byId = s.participants.find((p) => p.id === t);
  if (byId) return byId.id;
  const want = normNameKey(t);
  for (const p of s.participants) {
    if (normNameKey(p.name) === want) return p.id;
  }
  const tSlug = nameToSlug(t);
  for (const p of s.participants) {
    if (p.id.toLowerCase() === tSlug || nameToSlug(p.name) === tSlug) return p.id;
  }
  return null;
}

function normStatus(p: Participant): string {
  return String(p.status ?? 'active').toLowerCase();
}

/**
 * Generic round boundary: tick duration counters, increment round.
 * Rank bonuses, passives, phase changes are emitted by the model as separate mutations.
 */
function applyEndRound(s: LiveState): LiveState {
  const participants = s.participants.map((p) => {
    const x = { ...p };
    if (typeof x.shieldRoundsRemaining === 'number' && x.shieldRoundsRemaining > 0) {
      x.shieldRoundsRemaining -= 1;
      if (x.shieldRoundsRemaining === 0 && normStatus(x) === 'shielded') {
        x.status = 'active';
      }
    }
    if (typeof x.cursedRoundsRemaining === 'number' && x.cursedRoundsRemaining > 0) {
      x.cursedRoundsRemaining -= 1;
      if (x.cursedRoundsRemaining === 0 && normStatus(x) === 'cursed') {
        x.status = 'active';
      }
    }
    return x;
  });

  return {
    ...s,
    participants,
    round: s.round + 1,
  };
}

const ADD_ACTION_ALIASES = new Set([
  'add',
  'add_participants',
  'create_participants',
  'create_participant',
  'add_teams',
  'bulk_add_participants',
  'add_team',
]);

/**
 * LLMs often emit count, "participants" instead of "teams", or string entries.
 */
function deriveTeamsFromAction(act: {
  action: string;
  teams?: unknown;
  participants?: unknown;
  count?: unknown;
  n?: unknown;
  number?: unknown;
  participant_count?: unknown;
  participants_count?: unknown;
  num_participants?: unknown;
  numParticipants?: unknown;
  numberOfTeams?: unknown;
  teamCount?: unknown;
  defaultFields?: Record<string, unknown>;
}): Array<{ id?: string; name: string; score?: number; defaults?: Record<string, unknown> }> | null {
  const rawList = act.teams ?? act.participants;
  if (Array.isArray(rawList) && rawList.length > 0) {
    return rawList.map((item, i) => {
      if (typeof item === 'string') {
        return { name: item.trim() || `Team ${i + 1}`, score: 0 };
      }
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        const name = String(
          o.name ?? o.label ?? o.title ?? o.team ?? `Team ${i + 1}`,
        );
        const id = typeof o.id === 'string' ? o.id : undefined;
        const score =
          typeof o.score === 'number'
            ? o.score
            : typeof o.points === 'number'
              ? o.points
              : 0;
        return { id, name, score };
      }
      return { name: `Team ${i + 1}`, score: 0 };
    });
  }

  const countCandidates = [
    act.count,
    act.n,
    act.number,
    act.participant_count,
    act.participants_count,
    act.num_participants,
    act.numParticipants,
    act.numberOfTeams,
    act.teamCount,
  ];

  let fromCount = NaN;
  for (const c of countCandidates) {
    if (typeof c === 'number' && Number.isFinite(c)) {
      fromCount = c;
      break;
    }
    if (typeof c === 'string') {
      const parsed = Number(c);
      if (Number.isFinite(parsed)) {
        fromCount = parsed;
        break;
      }
    }
  }

  if (
    Number.isFinite(fromCount) &&
    fromCount > 0 &&
    fromCount <= 200 &&
    Math.floor(fromCount) === fromCount
  ) {
    const n = Math.floor(fromCount);
    const defaults = act.defaultFields;
    return Array.from({ length: n }, (_, i) => ({
      name: `Team ${i + 1}`,
      score: typeof defaults?.score === 'number' ? defaults.score : 0,
      defaults,
    }));
  }

  return null;
}

function normalizeAction(a: VoiceAction): VoiceAction {
  const any = a as { action: string };
  if (any.action === 'advance_round' || any.action === 'round_end') {
    return { action: 'end_round' };
  }
  if (any.action === 'set_global_field' || any.action === 'set_global') {
    return { ...(a as object), action: 'set_live_field' } as VoiceAction;
  }
  if (ADD_ACTION_ALIASES.has(any.action) && any.action !== 'add') {
    return { ...(a as object), action: 'add' } as VoiceAction;
  }
  switch (any.action) {
    case 'update_score': {
      const u = a as Record<string, unknown>;
      const idStr = String(
        u.id ?? u.targetId ?? u.playerId ?? u.teamId ?? u.name ?? '',
      );
      const delta = Number(u.delta ?? u.points ?? u.change ?? 0) || 0;
      return {
        action: 'update',
        id: idStr,
        delta,
        commentary:
          typeof u.commentary === 'string' ? u.commentary : undefined,
      };
    }
    case 'rename_entity': {
      const u = a as Record<string, unknown>;
      return {
        action: 'rename',
        id: String(u.id ?? u.targetId ?? u.name ?? ''),
        newName: String(u.newName ?? u.new_name ?? ''),
      };
    }
    case 'manage_timer':
      return {
        action: 'timer',
        state: (a as { state: string }).state as 'start' | 'stop' | 'pause' | 'reset',
        duration: (a as { duration?: number }).duration,
      };
    case 'change_scoring_mode':
      return {
        action: 'mode_switch',
        mode: (a as { mode: LiveState['scoring_mode'] }).mode,
        target: (a as { target?: number }).target,
        label: (a as { label?: string }).label,
      };
    case 'eliminate':
      return { action: 'remove', id: (a as { id: string }).id };
    default: {
      if (any.action === 'apply_rule_mutation') {
        const u = a as Record<string, unknown>;
        const tid = u.targetId ?? u.target_id ?? u.id ?? u.playerId;
        if (tid != null && String(tid).length > 0) {
          return { ...u, targetId: String(tid) } as VoiceAction;
        }
      }
      return a;
    }
  }
}

type PatchPair = {
  label: string;
  apply: (s: LiveState) => LiveState;
  revert: (s: LiveState) => LiveState;
};

function patchParticipantByIdOrName(
  idOrName: string,
  mutator: (prev: Participant) => Participant,
  reverter: (prev: Participant) => Participant,
): PatchPair {
  return {
    label: `patch participant ${idOrName}`,
    apply: (s) => {
      const rid = resolveParticipantId(s, idOrName);
      if (!rid) {
        console.warn('[VoiceTrack] No participant for id/name:', idOrName);
        return s;
      }
      return mapParticipants(s, (list) =>
        list.map((p) => (p.id === rid ? mutator(p) : p)),
      );
    },
    revert: (s) => {
      const rid = resolveParticipantId(s, idOrName);
      if (!rid) return s;
      return mapParticipants(s, (list) =>
        list.map((p) => (p.id === rid ? reverter(p) : p)),
      );
    },
  };
}

function applyRuleMutation(
  act: Extract<VoiceAction, { action: 'apply_rule_mutation' }>,
): PatchPair | null {
  const { targetId, field, operation, value } = act;

  if (field === 'score') {
    if (operation === 'set') {
      let oldScore = 0;
      return {
        label: `set score ${targetId}`,
        apply: (s) => {
          const rid = resolveParticipantId(s, targetId);
          if (!rid) {
            console.warn('[VoiceTrack] apply_rule_mutation target:', targetId);
            return s;
          }
          const cur = s.participants.find((p) => p.id === rid);
          oldScore = cur?.score ?? 0;
          return mapParticipants(s, (list) =>
            list.map((p) =>
              p.id === rid ? { ...p, score: Number(value) } : p,
            ),
          );
        },
        revert: (s) => {
          const rid = resolveParticipantId(s, targetId);
          if (!rid) return s;
          return mapParticipants(s, (list) =>
            list.map((p) =>
              p.id === rid ? { ...p, score: oldScore } : p,
            ),
          );
        },
      };
    }
    const delta =
      operation === 'increment'
        ? typeof value === 'number'
          ? value
          : Number(value) || 0
        : -(typeof value === 'number' ? value : Number(value) || 0);
    return patchParticipantByIdOrName(
      targetId,
      (p) => ({ ...p, score: p.score + delta }),
      (p) => ({ ...p, score: p.score - delta }),
    );
  }

  const key = field as string;
  let oldVal: unknown;
  return {
    label: `${operation} ${key} ${targetId}`,
    apply: (s) => {
      const rid = resolveParticipantId(s, targetId);
      if (!rid) {
        console.warn('[VoiceTrack] apply_rule_mutation target:', targetId);
        return s;
      }
      return mapParticipants(s, (list) =>
        list.map((p) => {
          if (p.id !== rid) return p;
          const next = { ...p } as Record<string, unknown>;
          oldVal = next[key];
          const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
          if (operation === 'set') {
            if (key === 'status' && typeof value === 'string') {
              next[key] = value.toLowerCase();
            } else {
              next[key] = value;
            }
          } else if (operation === 'increment') {
            const cur = typeof oldVal === 'number' ? oldVal : Number(oldVal) || 0;
            next[key] = cur + num(value);
          } else if (operation === 'decrement') {
            const cur = typeof oldVal === 'number' ? oldVal : Number(oldVal) || 0;
            next[key] = cur - num(value);
          } else if (operation === 'toggle') {
            next[key] = typeof oldVal === 'boolean' ? !oldVal : !Boolean(oldVal);
          }
          return next as unknown as Participant;
        }),
      );
    },
    revert: (s) => {
      const rid = resolveParticipantId(s, targetId);
      if (!rid) return s;
      return mapParticipants(s, (list) =>
        list.map((p) => {
          if (p.id !== rid) return p;
          const next = { ...p } as Record<string, unknown>;
          next[key] = oldVal;
          return next as unknown as Participant;
        }),
      );
    },
  };
}

function buildPatchForAction(act: VoiceAction): PatchPair | PatchPair[] | null {
  const kind = (act as { action: string }).action;
  console.log('[VoiceTrack] buildPatchForAction:', kind, act);

  if (kind === 'add' || kind === 'add_participants') {
    const derived = deriveTeamsFromAction(
      act as Parameters<typeof deriveTeamsFromAction>[0],
    );
    const teams =
      derived ??
      (Array.isArray((act as { teams?: unknown }).teams)
        ? deriveTeamsFromAction({
            action: 'add',
            teams: (act as { teams: unknown[] }).teams,
          })
        : null);
    if (!teams || teams.length === 0) {
      console.warn('[VoiceTrack] add_participants: could not derive teams from action:', act);
      return null;
    }

    const addedMeta: { ids: string[] } = { ids: [] };
    return {
      label: `add ${teams.length} teams`,
      apply: (s) => {
        const ids = new Set(s.participants.map((p) => p.id));
        const resolved = teams.map((t, i) => {
          const id = t.id && !ids.has(t.id) ? t.id : slugId(t.name, ids);
          ids.add(id);
          const defaults = t.defaults || {};
          return {
            id,
            name: t.name,
            score: t.score ?? 0,
            status: typeof defaults.status === 'string' ? defaults.status : 'active',
            reviveUsed: typeof defaults.reviveUsed === 'boolean' ? defaults.reviveUsed : false,
            reviveToken: typeof defaults.reviveToken === 'boolean' ? defaults.reviveToken : true,
            shieldToken: typeof defaults.shieldToken === 'boolean' ? defaults.shieldToken : true,
            shieldRoundsRemaining: typeof defaults.shieldRoundsRemaining === 'number' ? defaults.shieldRoundsRemaining : 0,
            cursedRoundsRemaining: typeof defaults.cursedRoundsRemaining === 'number' ? defaults.cursedRoundsRemaining : 0,
            momentumBuff: typeof defaults.momentumBuff === 'boolean' ? defaults.momentumBuff : false,
            avatarColor: COLORS[(s.participants.length + i) % COLORS.length],
          } satisfies Participant;
        });
        addedMeta.ids = resolved.map((r) => r.id);
        return { ...s, participants: [...s.participants, ...resolved] };
      },
      revert: (s) => ({
        ...s,
        participants: s.participants.filter((p) => !addedMeta.ids.includes(p.id)),
      }),
    };
  }

  if (kind === 'update' || kind === 'update_score') {
    const { id, delta } = act as { id: string; delta: number };
    const d = typeof delta === 'number' ? delta : Number(delta) || 0;
    return patchParticipantByIdOrName(
      id,
      (p) => ({ ...p, score: p.score + d }),
      (p) => ({ ...p, score: p.score - d }),
    );
  }

  if (kind === 'rename' || kind === 'rename_entity') {
    const { id, newName } = act as { id: string; newName: string };
    let prevName = '';
    return {
      label: `rename ${id}`,
      apply: (s) => {
        const rid = resolveParticipantId(s, id);
        if (!rid) return s;
        return mapParticipants(s, (list) =>
          list.map((p) => {
            if (p.id !== rid) return p;
            prevName = p.name;
            return { ...p, name: newName };
          }),
        );
      },
      revert: (s) => {
        const rid = resolveParticipantId(s, id);
        if (!rid) return s;
        return mapParticipants(s, (list) =>
          list.map((p) => (p.id === rid ? { ...p, name: prevName } : p)),
        );
      },
    };
  }

  if (kind === 'timer' || kind === 'manage_timer') {
    const t = act as {
      state: 'start' | 'stop' | 'pause' | 'reset';
      duration?: number;
    };
    let snapshot: TimerStateSnapshot | null = null;
    return {
      label: `timer ${t.state}`,
      apply: (s) => {
        snapshot = snapshotTimer(s);
        return applyTimerPatch(s, t.state, t.duration);
      },
      revert: (s) => (snapshot ? { ...s, timer: snapshot.timer } : s),
    };
  }

  if (kind === 'mode_switch' || kind === 'change_scoring_mode') {
    const m = act as {
      mode: LiveState['scoring_mode'];
      target?: number;
      label?: string;
    };
    let prev: Pick<LiveState, 'scoring_mode' | 'goal_target' | 'goal_label'> | null =
      null;
    return {
      label: `mode ${m.mode}`,
      apply: (s) => {
        prev = {
          scoring_mode: s.scoring_mode,
          goal_target: s.goal_target,
          goal_label: s.goal_label,
      };
        return {
          ...s,
          scoring_mode: m.mode,
          goal_target: m.target ?? s.goal_target,
          goal_label: m.label ?? s.goal_label,
        };
      },
      revert: (s) =>
        prev
          ? {
              ...s,
              scoring_mode: prev.scoring_mode,
              goal_target: prev.goal_target,
              goal_label: prev.goal_label,
            }
          : s,
    };
  }

  if (kind === 'remove' || kind === 'remove_participant') {
    const { id } = act as { id: string };
    let backup: Participant | null = null;
    return {
      label: `remove ${id}`,
      apply: (s) => {
        const rid = resolveParticipantId(s, id);
        if (!rid) return s;
        const p = s.participants.find((x) => x.id === rid);
        backup = p ? { ...p } : null;
        return {
          ...s,
          participants: s.participants.filter((x) => x.id !== rid),
        };
      },
      revert: (s) =>
        backup
          ? { ...s, participants: [...s.participants, backup] }
          : s,
    };
  }

  if (kind === 'apply_rule_mutation') {
    const p = applyRuleMutation(act as Extract<VoiceAction, { action: 'apply_rule_mutation' }>);
    return p;
  }

  if (kind === 'set_participant_field') {
    const { id, field, value } = act as {
      id: string;
      field: string;
      value: string | number | boolean;
    };
    let old: unknown;
    return {
      label: `set ${field} ${id}`,
      apply: (s) => {
        const rid = resolveParticipantId(s, id);
        if (!rid) return s;
        return mapParticipants(s, (list) =>
          list.map((p) => {
            if (p.id !== rid) return p;
            const copy = { ...p } as Record<string, unknown>;
            old = copy[field];
            copy[field] = value;
            return copy as unknown as Participant;
          }),
        );
      },
      revert: (s) => {
        const rid = resolveParticipantId(s, id);
        if (!rid) return s;
        return mapParticipants(s, (list) =>
          list.map((p) => {
            if (p.id !== rid) return p;
            const copy = { ...p } as Record<string, unknown>;
            copy[field] = old;
            return copy as unknown as Participant;
          }),
        );
      },
    };
  }

  if (kind === 'end_round') {
    let snapshot: LiveState | null = null;
    return {
      label: 'end_round',
      apply: (s) => {
        snapshot = structuredClone(s);
        return applyEndRound(s);
      },
      revert: (s) => (snapshot ? structuredClone(snapshot) : s),
    };
  }

  if (kind === 'set_live_field') {
    const { field, value } = act as {
      field: string;
      value: string | number | boolean;
    };
    if (field === 'participants' || field === 'timer') return null;
    let prev: unknown;
    return {
      label: `live.${field}`,
      apply: (s) => {
        prev = (s as unknown as Record<string, unknown>)[field];
        return { ...s, [field]: value } as LiveState;
      },
      revert: (s) =>
        ({
          ...s,
          [field]: prev,
        }) as LiveState,
    };
  }

  return null;
}

interface TimerStateSnapshot {
  timer: LiveState['timer'];
}

function snapshotTimer(s: LiveState): TimerStateSnapshot {
  return { timer: { ...s.timer, endsAt: s.timer.endsAt } };
}

function applyTimerPatch(
  s: LiveState,
  op: 'start' | 'stop' | 'pause' | 'reset',
  duration?: number,
): LiveState {
  const now = Date.now();
  if (op === 'start') {
    const sec = duration ?? s.timer.durationSec ?? 60;
    return {
      ...s,
      timer: {
        state: 'running',
        durationSec: sec,
        endsAt: now + sec * 1000,
      },
    };
  }
  if (op === 'stop' || op === 'reset') {
    return { ...s, timer: { state: 'idle', durationSec: s.timer.durationSec } };
  }
  if (op === 'pause') {
    return { ...s, timer: { ...s.timer, state: 'paused' } };
  }
  return s;
}

function composePatches(pairs: PatchPair[]): StateCommand {
  return {
    label: pairs.map((p) => p.label).join(' + '),
    apply: (s) => pairs.reduce((acc, p) => p.apply(acc), s),
    revert: (s) => pairs.reduceRight((acc, p) => p.revert(acc), s),
  };
}

export function voiceResponseToCommand(
  response: GroqAgentResponse,
): {
  command: StateCommand | null;
  commentary: string | undefined;
  /** System-level: handle undo/redo in hook, not as state patch */
  systemUndo: boolean;
  systemRedo: boolean;
} {
  const actions = (response.actions || []).map(normalizeAction);
  let commentary: string | undefined =
    typeof response.commentary === 'string' ? response.commentary : undefined;
  if (!commentary) {
    for (const a of actions) {
      const c = (a as { commentary?: string }).commentary;
      if (typeof c === 'string' && c.length) {
        commentary = c;
        break;
      }
    }
  }

  let systemUndo = false;
  let systemRedo = false;
  const patches: PatchPair[] = [];

  for (const raw of actions) {
    const kind = (raw as { action: string }).action;
    if (kind === 'undo') {
      systemUndo = true;
      continue;
    }
    if (kind === 'redo') {
      systemRedo = true;
      continue;
    }
    const built = buildPatchForAction(raw);
    if (!built) continue;
    if (Array.isArray(built)) patches.push(...built);
    else patches.push(built);
  }

  if (patches.length === 0) {
    return { command: null, commentary, systemUndo, systemRedo };
  }

  return {
    command: composePatches(patches),
    commentary,
    systemUndo,
    systemRedo,
  };
}
