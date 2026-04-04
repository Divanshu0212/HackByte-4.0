/** VoiceTrack — shared types aligned with the architecture blueprint */

export type ScoringType = 'linear' | 'non_linear';

export type ScoringMode = 'numeric' | 'goal_based' | 'pass_fail';

export interface RuleCondition {
  target: 'initiator' | 'receiver' | 'global';
  field: string;
  equals?: string | number | boolean;
}

export interface RuleAction {
  target: 'initiator' | 'receiver' | 'global';
  field: string;
  operation: 'increment' | 'decrement' | 'set' | 'toggle';
  value?: string | number | boolean;
}

export interface RuleTrigger {
  phrase: string;
  conditions?: RuleCondition[];
  actions: RuleAction[];
  commentary_hint?: string;
}

export interface RuleManifest {
  scoringType: ScoringType;
  triggers: RuleTrigger[];
  statusValues?: string[];
  commentary_hints?: Record<string, string>;
  /** Optional label for this ruleset (debugging, UI); not interpreted mechanically */
  rulesetLabel?: string;
}

export interface Participant {
  id: string;
  name: string;
  score: number;
  /** free-form status string (e.g. active, defeated); games define allowed values */
  status?: string;
  /** @deprecated prefer reviveToken; kept for undo compatibility */
  reviveUsed?: boolean;
  /** optional token / flag — games define semantics */
  reviveToken?: boolean;
  shieldToken?: boolean;
  /** optional timed effect (round-based) */
  shieldRoundsRemaining?: number;
  cursedRoundsRemaining?: number;
  /** optional flag — games define semantics (e.g. next bonus) */
  momentumBuff?: boolean;
  /** optional snapshot for revive / rollback math */
  scoreAtDefeat?: number;
  avatarColor?: string;
}

export interface TimerState {
  state: 'idle' | 'running' | 'paused';
  durationSec?: number;
  /** wall clock ms when running ends (for display) */
  endsAt?: number;
}

export interface LiveState {
  participants: Participant[];
  scoring_mode: ScoringMode;
  round: number;
  /** Fundraising / goal mode */
  goal_target?: number;
  goal_label?: string;
  timer: TimerState;
  /** optional global flag — games define semantics (e.g. late-stage rules) */
  suddenDeath?: boolean;
}

/** LLM action union — generative UI + undo + rule mutations */
export type VoiceAction =
  | {
      action: 'add' | 'add_participants';
      teams: Array<{ id?: string; name: string; score?: number }>;
    }
  | {
      action: 'update' | 'update_score';
      id: string;
      delta: number;
      commentary?: string;
    }
  | { action: 'rename' | 'rename_entity'; id: string; newName: string }
  | {
      action: 'timer' | 'manage_timer';
      state: 'start' | 'stop' | 'pause' | 'reset';
      duration?: number;
    }
  | {
      action: 'mode_switch' | 'change_scoring_mode';
      mode: ScoringMode;
      target?: number;
      label?: string;
    }
  | { action: 'undo' }
  | { action: 'redo' }
  | {
      action: 'remove' | 'remove_participant' | 'eliminate';
      id: string;
    }
  | {
      action: 'apply_rule_mutation';
      targetId: string;
      field: string;
      operation: 'increment' | 'decrement' | 'set' | 'toggle';
      value?: string | number | boolean;
    }
  | {
      action: 'set_participant_field';
      id: string;
      field: string;
      value: string | number | boolean;
    }
  | { action: 'end_round' | 'advance_round' | 'round_end' }
  | {
      action: 'set_live_field';
      /** Root LiveState key (client blocks participants, timer) */
      field: string;
      value: string | number | boolean;
    };

export interface GroqAgentResponse {
  thought?: string;
  observation?: string;
  actions: VoiceAction[];
  commentary?: string;
}
