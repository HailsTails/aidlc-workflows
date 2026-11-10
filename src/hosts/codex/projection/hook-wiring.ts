export type CodexHookEvent = "SessionStart" | "UserPromptSubmit" | "PreToolUse" | "PostToolUse" | "PermissionRequest" | "PreCompact" | "SubagentStart" | "SubagentStop" | "Stop";

// ---------------------------------------------------------------------------
// Hook wiring (kiro-normative shape: register ONLY events with a real core-hook
// consumer; dropped hooks ship unregistered).
// ---------------------------------------------------------------------------
export const HOOK_WIRING: ReadonlyArray<{ event: CodexHookEvent; matcher?: string; target: string }> = [
  { event: "SessionStart", target: "session-start" },
  { event: "UserPromptSubmit", target: "record-human-turn" },
  // One matcher-free group runs the four PreToolUse checks in one process: the
  // state-transition, reviewer-scope, review-freeze and plan-approval guards.
  // Codex starts every matching handler at once, and each guard's child engine
  // doubled it, so five rows cost nine engine loads per shell call (#2066).
  // Nothing rewrites the command: Codex gives every command it runs the session
  // as CODEX_THREAD_ID (0.145.0 and later), and the tools read it from there, so
  // the shipped rules/default.rules prefixes match the words the agent wrote. No matcher: each member self-filters on tool_name
  // (Bash, apply_patch, and spawn_agent naming the developer agent; Codex read
  // access rides the shell tool anyway), so a renamed Codex tool cannot
  // silently drop a guard, and the group beats in the record before each
  // engine command (hook health reads that heartbeat). Verified on 0.142.5:
  // subagent tool calls carry agent_type, and a PreToolUse exit 2 + stderr
  // blocks the call with the reason relayed.
  { event: "PreToolUse", target: "guard-tool-call" },
  { event: "PreToolUse", matcher: "spawn_agent", target: "deliver-stage-rules" },
  { event: "PostToolUse", matcher: "request_user_input", target: "record-human-turn" },
  { event: "PostToolUse", matcher: "apply_patch", target: "audit-and-sensors" },
  { event: "PostToolUse", matcher: "update_plan", target: "sync-workflow-state" },
  { event: "PostToolUse", matcher: "Bash", target: "rebuild-stage-graph" },
  { event: "PreCompact", target: "validate-state" },
  { event: "SubagentStop", target: "log-subagent" },
  { event: "Stop", target: "continue-workflow" },
];

