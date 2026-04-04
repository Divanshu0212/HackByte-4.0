/**
 * Generic interpreter guidance for any compiled (non-linear) ruleset — not tied to one game title.
 * The LLM maps voice → ordered JSON actions; the client applies them with undo.
 */
export function buildComplexGameInterpreterAppendix(): string {
  return `
## COMPLEX LIVE GAMES — HOW TO USE THIS ENGINE

You are grounding the operator's voice in TWO sources at once:
1) **GAME RULES** (compiled JSON manifest): triggers, conditions, ordered manifest actions.
2) **OPERATOR'S ORIGINAL RULES** (verbatim prose, if provided): nuances the JSON may not encode; when they conflict, prefer **safety + manifest** but fill gaps from prose when obvious.

### Output discipline
- Emit a **non-empty** "actions" array whenever the operator asked for a **state change**. Reasoning alone is never enough.
- Prefer **many small, ordered mutations** over one vague action. Chain reactions, transfers, split points, and global flags are expressed as **sequences** of \`apply_rule_mutation\`, \`set_participant_field\`, \`update_score\`, etc.
- Resolve every entity name to a concrete **id** from CURRENT LIVE STATE. Never invent ids.
- Use **lowercase** for \`status\` strings unless the manifest explicitly uses other casings.
- For **boolean** and **numeric** fields on participants, use \`apply_rule_mutation\` with \`set\` / \`increment\` / \`decrement\` / \`toggle\`, or \`set_participant_field\`.

### Participant fields (extend as the game requires)
The UI and undo stack support **arbitrary** keys on each participant via \`apply_rule_mutation\` and \`set_participant_field\`. Common patterns (add your own as needed):
- **score** (number)
- **status** (string: e.g. active, eliminated, shielded, stunned, bench, …)
- **Tokens / flags**: reviveToken, shieldToken, any named boolean
- **Timed effects**: shieldRoundsRemaining, cursedRoundsRemaining, any duration counter you decrement each round
- **Snapshots**: scoreAtElimination, lastDefeatedBy, comboMultiplier, …

### Live (global) fields
Use \`{"action":"set_live_field","field":"<key>","value":...}\` for **scalar** root fields on the live state (e.g. round, suddenDeath, goal\_target, custom flags). The executor rejects **participants** and **timer** (use dedicated actions for those). Prefer **boolean** and **number**; strings only if the state already uses them.

### \`end_round\` (generic tick)
\`{"action":"end_round"}\` means ONLY:
- Decrement per-participant duration counters (e.g. shieldRoundsRemaining, cursedRoundsRemaining) where your model uses them; clear **shielded** / **cursed** status when a counter hits 0.
- Increment \`round\` on the live state.

It does **not** apply rank bonuses, passives, or sudden-death — you must emit **separate** mutations for anything defined in the game's rules (first-place drip, comeback gold, phase changes, etc.), **before or after** \`end_round\` as logic requires. Typical order: apply this round's **resolution effects** first, then \`end_round\`; or follow the manifest.

### Combat-like events (pattern)
For "A beats B", "A eliminates B", shield blocks, reflected damage, etc.:
1. Read **conditions** from state (defeated? shielded? immune round? token spend?).
2. Emit the negations first (failed attack → penalize attacker), then the success path (loser's status, winner's score, momentum flags, token consumption).
3. If rules say side effects (curse spread, random target, split score), emit **one mutation per atomic fact** in order.

### Proportional / split scoring
Implement in the model: e.g. "50% to last place" → compute integers and emit **two** \`apply_rule_mutation\` on \`score\` or \`update_score\` entries.

### Randomness
Pick a **deterministic** id from the live list (e.g. stable sort by id, take index hash, or "lowest score among eligible") and state your choice in **observation** so operators can audit.

### \`add_participants\`
New entities should start with whatever defaults the prose requires (tokens true/false, status, zero counters). If unspecified, **active**, score 0, no mandatory extra fields.

### When \`scoringType\` is \`linear\` in the manifest
Still honor multi-step effects if the operator's prose defines them; use the same JSON action types.

### Commentary
Keep **commentary** short and audience-facing; it does not replace mutations.
`.trim();
}
