import type { LiveState, RuleManifest } from '../types';

const KEY_STATE = 'voicetrack_live_state';
const KEY_RULES = 'voicetrack_rule_manifest';
const KEY_DESC = 'voicetrack_rules_description';

/** Deferred persistence — fire-and-forget; UI does not await */
export function persistSessionSnapshot(
  state: LiveState,
  ruleManifest: RuleManifest | null,
  rawDescription?: string,
): void {
  queueMicrotask(() => {
    try {
      localStorage.setItem(KEY_STATE, JSON.stringify(state));
      if (ruleManifest) {
        localStorage.setItem(KEY_RULES, JSON.stringify(ruleManifest));
      } else {
        localStorage.removeItem(KEY_RULES);
      }
      if (rawDescription != null && rawDescription.length > 0) {
        localStorage.setItem(KEY_DESC, rawDescription);
      } else {
        localStorage.removeItem(KEY_DESC);
      }
    } catch (e) {
      console.error('Persist failed, will retry on next action:', e);
    }
  });
}

export function loadSessionSnapshot(): {
  state: LiveState | null;
  rules: RuleManifest | null;
  rawDescription: string;
} {
  try {
    const s = localStorage.getItem(KEY_STATE);
    const r = localStorage.getItem(KEY_RULES);
    const d = localStorage.getItem(KEY_DESC);
    return {
      state: s ? (JSON.parse(s) as LiveState) : null,
      rules: r ? (JSON.parse(r) as RuleManifest) : null,
      rawDescription: d || '',
    };
  } catch {
    return { state: null, rules: null, rawDescription: '' };
  }
}
