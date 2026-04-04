/**
 * Example ruleset illustrating multi-effect voice games (combat, shields, curses, round phases).
 * Replace with your own design — mechanics are interpreted by the compiler + runtime LLM, not hard-coded.
 */
export const EXAMPLE_COMPLEX_RULESET = `Multi-effect competition (example ruleset for testing)

Entities: each team has score, status (active / defeated / shielded / cursed), revive and shield tokens (booleans), optional round counters for timed effects.

Violence: "A defeats B" — winner gains points (more if they have a momentum flag from a prior defeat in the same session); loser becomes defeated; store score snapshot if revives use a fraction of former score.

Shield: "Shield A" — target becomes shielded for N rounds; failed attacks may penalize the attacker (emit separate score deltas).

Curse: "Curse A" — cursed for M rounds; when the cursed entity gains points, rules may divert part of the gain to another entity (emit multiple score mutations).

Revive: only if defeated and revive token remains — consume token, set active, restore score per rules.

Round end: host says "end round". Apply any rank-based passives, phase transitions, and timed effects per YOUR rules (emit explicit mutations), then use end_round to tick duration fields and increment the global round.

Chain / combo / late-game modes: express every consequence as ordered JSON actions; use set_live_field for global modes when needed.

Status strings in JSON should be lowercase unless the manifest specifies otherwise.`;
