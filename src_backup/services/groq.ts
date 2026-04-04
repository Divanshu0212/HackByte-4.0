import type { GroqAgentResponse, LiveState, RuleManifest } from '../types';
import { buildComplexGameInterpreterAppendix } from './complexGamePrompt';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

function getApiKey(): string {
  const key = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
  if (!key) {
    throw new Error(
      'Missing VITE_GROQ_API_KEY. Add it to voicetrack/.env (see .env.example).',
    );
  }
  return key;
}

async function groqJsonCompletion(system: string, user: string): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Groq API error ${res.status}: ${t}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty Groq response');
  return content;
}

/** Rule Compilation — executed ONCE at session start, not per voice command */
export async function compileRuleManifest(
  naturalLanguageDescription: string,
): Promise<RuleManifest> {
  const system = `You are a game rules compiler. Given a natural language description of a game's scoring logic, 
extract and output a strict JSON Rule Manifest. The manifest must define:
- scoringType: "linear" | "non_linear"
- triggers: an array of trigger objects, each containing:
    - phrase: a regex-friendly description of the voice command pattern that activates this rule
    - conditions: optional array of preconditions that must be true in the current game state, each with target "initiator"|"receiver"|"global", field, and optional equals
    - actions: an ordered array of state mutations, each with:
        - target: "initiator" | "receiver" | "global"
        - field: the state field to mutate (e.g., "score", "status", "round")  
        - operation: "increment" | "decrement" | "set" | "toggle"
        - value: the value or formula for the mutation (optional for toggle/increment)
- statusValues: all status-like values entities can hold for this game (lowercase strings recommended)
- commentary_hints: optional object mapping trigger phrase keys to short strings for commentary
- rulesetLabel: optional short human-readable name for this ruleset (e.g. "Regional playoffs 2026") — not interpreted mechanically

For deep games, include **many specific triggers** (combat, items, phases, round-end hooks) so the runtime model can match voice to structured intents. Output rich triggers rather than vague bullets.

Output ONLY valid JSON matching: {"scoringType","triggers","statusValues","commentary_hints","rulesetLabel"}. No prose, no markdown.`;

  const raw = await groqJsonCompletion(system, naturalLanguageDescription);
  return JSON.parse(raw) as RuleManifest;
}

function verbatimRulesBlock(rawDescription: string): string {
  const t = rawDescription.trim();
  if (!t) return '';
  return `

## OPERATOR'S ORIGINAL RULES (verbatim — use to disambiguate; merge with manifest)
${t}
`;
}

export function buildSystemPrompt(
  ruleManifest: RuleManifest | null,
  currentLiveState: LiveState,
  rawDescription = '',
): string {
  if (ruleManifest == null) {
    return `
You are the VoiceTrack command interpreter for a live event (LINEAR / default scoring mode).

## CURRENT LIVE STATE
${JSON.stringify(currentLiveState, null, 2)}

## ReAct PROTOCOL
Use internal reasoning but OUTPUT ONLY a single JSON object (no markdown) with keys:
- "thought": brief reasoning about resolving entity references (e.g. "second place") against the state
- "observation": what in the state is relevant
- "actions": array of actions (see SCHEMA below)
- "commentary": one energetic sports-style line for the audience (substitute real team names)

## ACTION SCHEMA (strict)
The "actions" array MUST contain every concrete mutation. Never return "actions": [] when the operator asked to change the board (e.g. add teams). Phrases like "create 5 participants", "add five teams", or "N slots" MUST become one add_participants action with exactly N team objects.

### Participant targeting (critical)
Copy **exact \`id\` values** from CURRENT LIVE STATE (e.g. \`team_4\`) into every \`id\`, \`targetId\`, \`playerId\` field. If you use a display name instead, it must match the **exact \`name\` string** from state (e.g. \`"Team 4"\`); the client resolves names, but wrong strings still fail. Thought/observation text alone does **not** change scores — only entries in \`actions\` do.

Each element of "actions" is one of:
- {"action":"add_participants","teams":[{"id":"team_slug","name":"Display Name","score":0}, ...]}  — use sequential default names ("Team 1".."Team N") if names are unspecified
- {"action":"add_participants","count":N} — ONLY if you cannot list teams; the client will create "Team 1" through "Team N"
- {"action":"update_score","id":"team_id","delta":number}
- {"action":"rename_entity","id":"team_id","newName":"string"}
- {"action":"manage_timer","state":"start"|"stop"|"pause"|"reset","duration":seconds number optional}
- {"action":"change_scoring_mode","mode":"numeric"|"goal_based"|"pass_fail","target":number optional,"label":"string optional"}
- {"action":"undo"} — revert last command
- {"action":"redo"} — re-apply undone command
- {"action":"remove_participant","id":"team_id"} — remove team (optional)
- {"action":"set_participant_field","id":"team_id","field":string,"value":string|number|boolean}
- {"action":"apply_rule_mutation","targetId":"id","field":string,"operation":"increment"|"decrement"|"set"|"toggle","value":...}
- {"action":"end_round"} — ticks timed participant counters and increments global round only (see COMPLEX appendix when using compiled rules)
- {"action":"set_live_field","field":string,"value":string|number|boolean} — set scalar on live root state (not participants or timer)

For score changes only, also put the best summary string in "commentary".
Output ONLY valid JSON.
`.trim();
  }

  const complexDoc = `

## MULTI-EFFECT INTERPRETATION (always applies when compiled rules are present)

${buildComplexGameInterpreterAppendix()}
`;

  return `
You are the VoiceTrack command interpreter for a live event.

## GAME RULES (compiled JSON — authoritative structure)
${JSON.stringify(ruleManifest, null, 2)}
${verbatimRulesBlock(rawDescription)}
## CURRENT LIVE STATE
${JSON.stringify(currentLiveState, null, 2)}

## ReAct PROTOCOL
Interleave reasoning as JSON fields:
- "thought": resolve pronouns and references using ranks/names in CURRENT LIVE STATE
- "observation": cite relevant state facts; mention how manifest + verbatim rules led to your actions
- "actions": array of mutations (never empty when the operator asked to change participants or game state)
- "commentary": audience-facing line when helpful

## YOUR TASK
1. Match the operator voice command against GAME RULES triggers. When multiple overlap, choose the best fit and note why in observation.
2. Setup commands (add N teams, rename, timers, layout) MUST use the usual action types even if they do not match a trigger.
3. Emit **ordered** apply_rule_mutation / set_participant_field / update_score / add_participants / set_live_field / end_round to realize **every** consequence in the manifest and verbatim prose for this utterance. **Never rely on thought/observation alone — the UI only applies the "actions" array.**
4. **Participant ids:** use exact \`id\` from CURRENT LIVE STATE, or exact \`name\` as the id field when needed (see Participant targeting above).
5. apply_rule_mutation supports **any** participant field string the state uses (score, status, booleans, round counters, custom keys).
6. set_live_field: only for **root** live keys; never use for "participants" or "timer". Prefer booleans and numbers.
7. end_round: only duration tick + round increment; all scoring and passives for "end of round" must be **separate** mutations you emit (order as logic requires).
8. Include "commentary" when it helps spectators.
${complexDoc}
Output ONLY valid JSON with keys thought, observation, actions, commentary.
`.trim();
}

function normalizeAgentResponse(parsed: unknown): GroqAgentResponse {
  const o = parsed as Record<string, unknown>;
  let actions = o.actions;
  if (!Array.isArray(actions) && Array.isArray(o.mutations)) {
    actions = o.mutations;
  }
  if (Array.isArray(actions) && actions.length === 1 && actions[0] && typeof actions[0] === 'object') {
    const sole = actions[0] as Record<string, unknown>;
    if (!sole.action && Array.isArray(sole.actions)) {
      actions = sole.actions;
    }
  }
  if (!Array.isArray(actions) && actions && typeof actions === 'object') {
    actions = [actions];
  }
  if (!Array.isArray(actions) && typeof o.action === 'string') {
    const clone = { ...o } as Record<string, unknown>;
    delete clone.thought;
    delete clone.observation;
    delete clone.commentary;
    actions = [clone];
  }
  if (!Array.isArray(actions)) actions = [];
  return {
    thought: typeof o.thought === 'string' ? o.thought : undefined,
    observation:
      typeof o.observation === 'string' ? o.observation : undefined,
    actions: actions as GroqAgentResponse['actions'],
    commentary: typeof o.commentary === 'string' ? o.commentary : undefined,
  };
}

export async function interpretVoiceCommand(
  ruleManifest: RuleManifest | null,
  currentLiveState: LiveState,
  transcribedText: string,
  rawDescription = '',
): Promise<GroqAgentResponse> {
  const system = buildSystemPrompt(ruleManifest, currentLiveState, rawDescription);
  const user = `Operator voice command (transcribed):\n"""${transcribedText}"""\n\nReturn the JSON response now.`;
  const raw = await groqJsonCompletion(system, user);
  const parsed = JSON.parse(raw);
  return normalizeAgentResponse(parsed);
}
