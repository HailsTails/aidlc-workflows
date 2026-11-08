import { codexHookTrustHash } from "../../core/tools/aidlc-command.ts";
import { EXTENDED_SUBPROCESS_TIMEOUT_MS } from "../../core/tools/aidlc-runtime-budget.ts";

export type CodexRuntimeBinding = {
  readonly harnessDir: string;
  readonly harnessName: string;
  readonly invoke: string;
  readonly trustedNamespace: string;
};
export type CodexHookEvent = {
  readonly event: string;
  readonly groups: readonly { readonly target: string; readonly matcher?: string }[];
};
export type CodexHookGroup = {
  readonly index: number;
  readonly command: string;
  readonly timeout: number;
  readonly matcher?: string;
};
export type CodexHookPlan = readonly {
  readonly event: string;
  readonly identity: string;
  readonly groups: readonly CodexHookGroup[];
}[];

const events: readonly CodexHookEvent[] = [
  { event: "SessionStart", groups: [{ target: "session-start" }] },
  { event: "UserPromptSubmit", groups: [{ target: "record-human-turn" }] },
  // The matcher-free guard self-filters. Separate Codex handlers run concurrently;
  // a single process keeps the four checks ordered and avoids repeated engine loads.
  { event: "PreToolUse", groups: [{ target: "guard-tool-call" }, { target: "deliver-stage-rules", matcher: "spawn_agent" }] },
  { event: "PostToolUse", groups: [
    { target: "record-human-turn", matcher: "request_user_input" },
    { target: "audit-and-sensors", matcher: "apply_patch" },
    { target: "sync-workflow-state", matcher: "update_plan" },
    { target: "rebuild-stage-graph", matcher: "Bash" },
  ] },
  { event: "PreCompact", groups: [{ target: "validate-state" }] },
  { event: "SubagentStop", groups: [{ target: "log-subagent" }] },
  { event: "Stop", groups: [{ target: "continue-workflow" }] },
];

const eventIdentity = (event: string): string => event.replace(/[A-Z]/g, (letter, index) => (index === 0 ? "" : "_") + letter.toLowerCase());
const timeoutSeconds = (target: string): number => (EXTENDED_SUBPROCESS_TIMEOUT_MS / 1000) * (target === "continue-workflow" || target === "audit-and-sensors" ? 2 : 1);
const resolveGroup = ({ group, index, binding }: { readonly group: CodexHookEvent["groups"][number]; readonly index: number; readonly binding: CodexRuntimeBinding }): CodexHookGroup => {
  const command = binding.invoke + " " + binding.trustedNamespace + " adapter " + binding.harnessName + " " + group.target;
  const timeout = timeoutSeconds(group.target);
  const matcher = group.matcher || undefined;
  return { index, command, timeout, ...(matcher === undefined ? {} : { matcher }) };
};

// Both representations consume these resolved identities. Neither serializer
// selects commands, calculates budgets, normalizes matchers, or counts groups.
export const resolveCodexHookPlan = ({ binding, registrations = events }: { readonly binding: CodexRuntimeBinding; readonly registrations?: readonly CodexHookEvent[] }): CodexHookPlan => {
  if (new Set(registrations.map(({ event }) => event)).size !== registrations.length) throw new Error("Codex hook events must be unique; add handlers to the existing event group");
  return registrations.map(({ event, groups }) => {
    const identity = eventIdentity(event);
    return { event, identity, groups: groups.map((group, index) => resolveGroup({ group, index, binding })) };
  });
};

export const emitHooksJson = (plan: CodexHookPlan): string => JSON.stringify({ hooks: Object.fromEntries(plan.map(({ event, groups }) => [event, groups.map(({ command, timeout, matcher }) => ({ hooks: [{ type: "command", command, timeout }], ...(matcher === undefined ? {} : { matcher }) }))])) }, null, 2) + "\n";

export const hookTrustState = ({ plan, hooksJsonPath }: { readonly plan: CodexHookPlan; readonly hooksJsonPath: string }): Readonly<Record<string, Readonly<Record<string, string>>>> => Object.fromEntries(plan.flatMap(({ identity, groups }) => groups.map(({ index, command, timeout, matcher }) => [hooksJsonPath + ":" + identity + ":" + index + ":0", Object.fromEntries([["trusted_hash", codexHookTrustHash(identity, command, timeout, matcher)]])])));
