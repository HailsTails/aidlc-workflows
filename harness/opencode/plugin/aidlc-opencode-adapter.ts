// aidlc-opencode-adapter.ts — the opencode hook shim (AUTHORED shell file; the
// aidlc-*.ts hook bodies in <project>/.aidlc/hooks/ are PACKAGED core,
// byte-shared with the Claude Code harness).
//
// opencode has no settings.json/hooks.json hook registry; its extension seam is
// the PLUGIN API (auto-discovered from .opencode/plugin/*.ts, loaded in-process
// by the opencode runtime). This one plugin maps opencode's hook surface onto
// the core hook bodies, each run as a bun subprocess fed the ClaudeCodeHookInput
// JSON shape the core hooks parse (live-verified on opencode 1.17.18):
//
//   opencode moment                      → core hook (Claude event it mirrors)
//   ------------------------------------------------------------------------
//   chat.message (first per session)     → aidlc-session-start.ts  (SessionStart)
//   chat.message (every human turn)      → aidlc-record-human-turn.ts  (UserPromptSubmit)
//   tool.execute.before task             → aidlc-deliver-stage-rules.ts rewrite + plan-approval guard (PreToolUse)
//   tool.execute.before other tools      → entrypoint boundary + aidlc-reviewer-scope.ts (PreToolUse)
//   tool.execute.after write|edit|patch  → aidlc-write-audit-log.ts + aidlc-run-sensors.ts (PostToolUse Write|Edit)
//   tool.execute.after bash              → aidlc-rebuild-stage-graph.ts (PostToolUse Bash)
//   tool.execute.after todowrite         → aidlc-sync-workflow-state.ts (PostToolUse TaskUpdate)
//   tool.execute.after task              → aidlc-log-subagent.ts    (SubagentStop)
//   event session.idle                   → aidlc-continue-workflow.ts            (Stop)
//   experimental.session.compacting      → aidlc-validate-state.ts  (PreCompact)
//
// Stop enforcement: session.idle is a REACTIVE event (opencode has no blocking
// continue-workflow channel), so when the core continue-workflow hook answers {"decision":"block",
// "reason":…} this plugin re-engages the loop by injecting the reason as a new
// session prompt via the SDK client. The injected prompt carries the NUDGE
// sentinel so the chat.message arm never mints HUMAN presence for it (a
// synthetic nudge is not a human turn), and loop-guarding stays with the core
// hook's run-mode-aware no-progress ceiling — this shim never counts.
//
// Known degradations vs Claude Code (documented in AGENTS.md):
//   - session-start's additionalContext has no injection channel; the hook
//     still runs for its side effects (session→intent stamp, state checks).
//   - There is no session-end moment; SESSION_ENDED is not emitted.
//   - Presence minting is skipped for subagent (child) sessions. A parent
//     lookup failure fails closed for that event and is retried later; an
//     uncertain child can never record-human-turn a HUMAN_TURN into the shared ledger.
//   - tool.execute.before carries no active-agent field. Reviewer identity is
//     correlated from chat.message.agent by session; when that field is absent,
//     a child session is treated as scoped registration while a dispatch record
//     exists. This can scope another child worker during that narrow window,
//     but never scopes the main session.

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

const NUDGE_SENTINEL = "[aidlc-forwarding-nudge]";
const PROJECTED_INVOKE = "{{INVOKE}}";
const TRUSTED_NAMESPACE = "{{TRUSTED_NAMESPACE}}";
const PROJECTED_TRUSTED_NAMESPACE = TRUSTED_NAMESPACE.startsWith("{{")
  ? "engine"
  : TRUSTED_NAMESPACE;
const DEFAULT_AIDLC_COMMAND = PROJECTED_INVOKE.startsWith("{{")
  ? ["bun", ".aidlc/tools/aidlc.ts", PROJECTED_TRUSTED_NAMESPACE]
  : [...PROJECTED_INVOKE.trim().split(/\s+/), PROJECTED_TRUSTED_NAMESPACE];

// The core hook bodies ship in the ENGINE dir (<project>/.aidlc/hooks/), not
// beside this plugin — .opencode/ carries only natively-consumed surfaces.
// Resolved per-call from the project directory opencode hands the plugin.
const HARNESS_LEAF = ".aidlc";
const HOOKS_SUBDIR = join(HARNESS_LEAF, "hooks");

const hookPathFor = (hookFile: string, projectDir: string): string =>
  hookFile.includes("/") || hookFile.includes("\\")
    ? join(projectDir, hookFile)
    : join(projectDir, HOOKS_SUBDIR, hookFile);

// The opencode runtime is its own binary, so process.execPath is NOT bun.
// Resolve bun from PATH, then the default install dir; absent → every hook is
// a silent no-op (advisory hooks fail open, mirroring the plugin compose hook).
// A hook may deny through EITHER protocol: exit code 2 with the reason on
// stderr, or exit 0 carrying {"hookSpecificOutput":{"permissionDecision":
// "deny","permissionDecisionReason":…}} on stdout. Claude Code honours both
// natively; every shimmed face reaches its hooks through runCore, so the JSON
// form is normalised to the exit-2 form HERE — once — rather than at each of
// the call sites that test `code === 2`. Reading only the exit code silently
// discards the JSON denials (inline-exec, gh-write and destructive-git all use
// that form), which reads as an installed rail that permits what it forbids.
function deniedByStructuredOutput(stdout: string): string | null {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) return null;
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as {
      hookSpecificOutput?: {
        permissionDecision?: unknown;
        permissionDecisionReason?: unknown;
      };
    };
    const decision = parsed.hookSpecificOutput?.permissionDecision;
    if (decision !== "deny") return null;
    const reason = parsed.hookSpecificOutput?.permissionDecisionReason;
    return typeof reason === "string" && reason.trim().length > 0
      ? reason
      : "Blocked by an AIDLC guard hook.";
  } catch {
    return null;
  }
}

function normalisedHookResult(result: {
  stdout: string;
  stderr: string;
  code: number;
}): { stdout: string; stderr: string; code: number } {
  if (result.code === 2) return result;
  const denialReason = deniedByStructuredOutput(result.stdout);
  if (denialReason === null) return result;
  // The reason moves onto stderr because every call site sources its block
  // message from there; leaving it only in stdout blocks with an empty message.
  return {
    stdout: result.stdout,
    stderr: result.stderr.trim().length > 0 ? result.stderr : denialReason,
    code: 2,
  };
}

function runCoreHook(
  hookFile: string,
  input: Record<string, unknown>,
  cwd: string,
  aidlcCommand: readonly string[],
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const [bin, ...prefix] = aidlcCommand;
    const hook = hookFile.replace(/^aidlc-/, "").replace(/\.ts$/, "");
    if (!bin) return resolve({ stdout: "", stderr: "", code: 0 });
    try {
      // Core hooks route through the native dispatcher, which resolves the hook
      // by NAME from the installed engine — the v2.9.0 install model. Every
      // core body is named aidlc-<name>.ts, which is exactly the prefix the
      // `hook` derivation above strips to recover that name.
      //
      // A plugin-contributed row is different IN KIND, not merely in spelling:
      // the dispatcher knows only core's own hook names, so a plugin row can
      // never be resolved by name and is always spawned by PATH. Such a row
      // normally carries a bare filename resolved against the install's hooks
      // dir (where a plugin's bodies arrive through the content path); it may
      // instead declare a project-relative path for a body that legitimately
      // sits elsewhere, such as a plugin's composer in its own dist tree, and
      // hookPathFor handles both spellings.
      //
      // Discriminating on origin rather than on whether the string contains a
      // separator is load-bearing: plugin rows are USUALLY bare filenames, so
      // a separator test would route the common plugin row into the dispatcher
      // and it would fail to resolve — a registered guard that never runs.
      const isCoreHook = hookFile.startsWith("aidlc-");
      const argv = isCoreHook
        ? [...prefix, "hook", hook, "--project-dir", cwd]
        : [hookPathFor(hookFile, cwd)];
      const child = spawn(bin, argv, {
        cwd,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          AIDLC_PROJECT_DIR: cwd,
          CLAUDE_PROJECT_DIR: cwd,
          // Core hooks that resolve a harness-relative path default to
          // ".claude" when this is unset — correct for the Claude face and
          // wrong for every other. The composer is the load-bearing case: it
          // writes plugin content INTO the harness dir, so an unset value
          // composes into a directory this face does not use.
          AIDLC_HARNESS_DIR: HARNESS_LEAF,
        },
      });
      let out = "";
      let err = "";
      child.stdout.on("data", (d: Buffer) => {
        out += d.toString();
      });
      child.stderr.on("data", (d: Buffer) => {
        err += d.toString();
      });
      child.on("error", () => resolve({ stdout: "", stderr: "", code: 0 })); // fail open
      child.on("close", (code: number | null) =>
        resolve(
          normalisedHookResult({ stdout: out, stderr: err, code: code ?? 0 })
        )
      );
      child.stdin.write(JSON.stringify(input));
      child.stdin.end();
    } catch {
      resolve({ stdout: "", stderr: "", code: 0 }); // fail open
    }
  });
}

export type PluginInput = {
  client: {
    session: {
      get: (opts: { path: { id: string } }) => Promise<{ data?: { parentID?: string } }>;
      prompt: (opts: {
        path: { id: string };
        body: { parts: Array<{ type: "text"; text: string }> };
      }) => Promise<unknown>;
    };
  };
  directory: string;
  /** Unit-test seam. Production uses the build-time list embedded by emit.ts. */
  aidlcEntrypoints?: ReadonlySet<string>;
  /** Unit-test seam. Production uses the projected framework dispatcher. */
  aidlcCommand?: readonly string[];
};

const AIDLC_BUN_PREFIX = /^bun[ \t]+\.aidlc\/(?:tools|hooks)\//;
const AIDLC_ENTRYPOINT = /^\.aidlc\/(tools|hooks)\/([A-Za-z0-9][A-Za-z0-9._-]*\.ts)$/;

// emit.ts replaces the empty array with every packaged .aidlc/{tools,hooks}/*.ts
// path. The adapter can then reject a newly-authored payload.ts even though the
// host's coarse bash permission glob matches it.
const shippedAidlcEntrypoints: ReadonlySet<string> = new Set<string>(
  /* @aidlc-shipped-entrypoints@ */ [],
);

const PROJECTED_BUN_TOOLS = DEFAULT_AIDLC_COMMAND[0] === "bun"
  ? (DEFAULT_AIDLC_COMMAND[1] ?? "").replace(/aidlc\.ts$/, "")
  : null;

/** Parse one expansion-free shell command into argv, or reject shell syntax. */
function directShellWords(command: string): string[] | null {
  const words: string[] = [];
  let word = "";
  let wordStarted = false;
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote === "'") {
      if (ch === "'") quote = null;
      else word += ch;
      continue;
    }
    if (quote === '"') {
      if (ch === '"') {
        quote = null;
        continue;
      }
      if (ch === "\\" && i + 1 < command.length) {
        const next = command[++i];
        if (next === "\n" || next === "\r") return null;
        word += next;
        continue;
      }
      if (ch === "`" || ch === "$" || ch === "\n" || ch === "\r") return null;
      word += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      wordStarted = true;
      continue;
    }
    if (ch === " " || ch === "\t") {
      if (wordStarted) {
        words.push(word);
        word = "";
        wordStarted = false;
      }
      continue;
    }
    if (
      ch === "\n" ||
      ch === "\r" ||
      ch === "\\" ||
      ch === "`" ||
      ch === "$" ||
      ch === "#" ||
      ch === ";" ||
      ch === "|" ||
      ch === "&" ||
      ch === "(" ||
      ch === ")" ||
      ch === "<" ||
      ch === ">"
    ) {
      return null;
    }
    word += ch;
    wordStarted = true;
  }
  if (quote !== null) return null;
  if (wordStarted) words.push(word);
  return words;
}

/** Return a denial reason only when the static AIDLC allow-prefix would match. */
function aidlcBashBoundaryViolation(
  command: string,
  allowedEntrypoints: ReadonlySet<string> = shippedAidlcEntrypoints,
): string | null {
  if (/^aidlc(?:[ \t]|$)/.test(command)) {
    const words = directShellWords(command);
    if (words?.[0] === "aidlc") return null;
    return (
      "AIDLC bash permission allows one direct invocation of a framework tool only. " +
      "Do not use chaining, redirection, expansion, or command substitution."
    );
  }
  if (PROJECTED_BUN_TOOLS === null) {
    return null;
  }
  if (!AIDLC_BUN_PREFIX.test(command)) return null;
  const words = directShellWords(command);
  const target = words?.[1]?.match(AIDLC_ENTRYPOINT);
  if (
    words?.[0] === "bun" &&
    target &&
    allowedEntrypoints.has(`${target[1]}/${target[2]}`)
  ) {
    return null;
  }
  return (
    "AIDLC bash permission allows one direct invocation of a shipped tool or hook only. " +
    "Use an unchanged .aidlc entrypoint without chaining, redirection, expansion, or command substitution."
  );
}

/** Extract every source and destination path touched by an apply_patch call. */
function applyPatchPaths(args: Record<string, unknown>): string[] {
  const patch =
    (args.patchText as string) ??
    (args.patch as string) ??
    (args.command as string) ??
    "";
  const paths: string[] = [];
  for (const match of patch.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)) {
    paths.push(match[1].trim());
  }
  for (const match of patch.matchAll(/^\*\*\* Move to: (.+)$/gm)) {
    paths.push(match[1].trim());
  }
  return Array.from(new Set(paths.filter((p) => p.length > 0)));
}

type ReviewerCall = {
  toolName: "Read" | "Edit" | "Write" | "LS" | "Glob" | "Grep" | "Bash";
  toolInput: Record<string, unknown>;
};

type PluginHookRow = {
  event: string;
  matcher?: string;
  target: string;
  hookFile: string;
};

// Plugin-contributed rows, emitted beside this plugin by harness/opencode/emit.ts.
// Read from disk (never imported) because this file ships in dist/ with no
// packager available. Absent or malformed reads to an empty list: a plugin
// wiring problem must never break core's own routing.
const pluginRowsCache = new Map<string, PluginHookRow[]>();

function pluginRows(cwd: string): PluginHookRow[] {
  const cached = pluginRowsCache.get(cwd);
  if (cached !== undefined) return cached;
  const rowsPath = join(cwd, HOOKS_SUBDIR, "plugin-hook-rows.json");
  const rows = ((): PluginHookRow[] => {
    if (!existsSync(rowsPath)) return [];
    try {
      const parsed: unknown = JSON.parse(readFileSync(rowsPath, "utf-8"));
      return Array.isArray(parsed) ? (parsed as PluginHookRow[]) : [];
    } catch {
      return [];
    }
  })();
  pluginRowsCache.set(cwd, rows);
  return rows;
}

function pluginRowsFor(event: string, cwd: string): PluginHookRow[] {
  return pluginRows(cwd).filter((row) => row.event === event);
}

// opencode names its tools lowercase ("bash"); a contributed matcher is written
// in the Claude vocabulary core hooks use ("Bash"), so the comparison is on the
// projected name. Keeping one vocabulary means a plugin declares the same
// matcher for every face rather than learning each harness's tool names.
// opencode names its tools lowercase; a contributed matcher is written in the
// Claude vocabulary core hooks use. Derived from the tool NAME alone, never from
// a call built with empty args: a patch envelope with no paths yields no calls,
// which would silently leave apply_patch unmatched by a Write|Edit matcher — a
// guard that appears registered and never fires on the edit surface.
const claudeToolNameByOpencodeTool: Readonly<Record<string, string>> = {
  bash: "Bash",
  read: "Read",
  write: "Write",
  edit: "Edit",
  apply_patch: "Write",
  glob: "Glob",
  grep: "Grep",
  list: "LS",
  task: "Task",
  todowrite: "TaskUpdate",
};

function claudeToolName(tool: string): string {
  return claudeToolNameByOpencodeTool[tool] ?? tool;
}

function matchesTool(matcher: string, tool: string): boolean {
  const projected = claudeToolName(tool);
  return matcher.split("|").some((candidate) => candidate.trim() === projected);
}

function reviewerCalls(tool: string, args: Record<string, unknown>): ReviewerCall[] {
  if (tool === "bash") {
    return [{ toolName: "Bash", toolInput: { command: (args.command as string) ?? "" } }];
  }
  if (tool === "read") {
    return [{
      toolName: "Read",
      toolInput: { file_path: (args.filePath as string) ?? (args.path as string) ?? "" },
    }];
  }
  if (tool === "write") {
    return [{
      toolName: "Write",
      toolInput: { file_path: (args.filePath as string) ?? (args.path as string) ?? "" },
    }];
  }
  if (tool === "edit") {
    return [{
      toolName: "Edit",
      toolInput: { file_path: (args.filePath as string) ?? (args.path as string) ?? "" },
    }];
  }
  if (tool === "glob") {
    return [{
      toolName: "Glob",
      toolInput: {
        pattern: (args.pattern as string) ?? "",
        path: (args.path as string) ?? "",
      },
    }];
  }
  if (tool === "grep") {
    return [{
      toolName: "Grep",
      toolInput: {
        pattern: (args.pattern as string) ?? "",
        path: (args.path as string) ?? "",
        glob: (args.include as string) ?? "",
      },
    }];
  }
  if (tool === "list") {
    return [{
      toolName: "LS",
      toolInput: { path: (args.path as string) ?? "" },
    }];
  }
  if (tool === "apply_patch") {
    return applyPatchPaths(args).map((filePath) => ({
      toolName: "Write",
      toolInput: { file_path: filePath },
    }));
  }
  return [];
}

function sessionStartHandled(stdout: string): boolean {
  try {
    const parsed = JSON.parse(stdout) as { additionalContext?: unknown };
    return typeof parsed.additionalContext === "string";
  } catch {
    return false;
  }
}

export default async ({
  client,
  directory,
  aidlcEntrypoints = shippedAidlcEntrypoints,
  aidlcCommand = DEFAULT_AIDLC_COMMAND,
}: PluginInput) => {
  const runCore = (
    hookFile: string,
    input: Record<string, unknown>,
    _cwd = directory,
  ) => runCoreHook(hookFile, input, directory, aidlcCommand);

  // Sessions whose session-start hook reached an active workflow.
  const started = new Set<string>();
  // Main sessions that delivered a real human turn. Stop enforcement keys on
  // this lighter latch because workflow state can be created during turn one.
  const sawHumanTurn = new Set<string>();
  // Sessions confirmed as main (no parentID) — presence + continue-workflow enforcement
  // apply only to these; child (task-tool) sessions are workers, not humans.
  const mainSession = new Map<string, boolean>();
  const sessionAgent = new Map<string, string>();
  const idleInFlight = new Set<string>();

  async function isMainSession(sessionID: string): Promise<boolean> {
    const cached = mainSession.get(sessionID);
    if (cached !== undefined) return cached;
    try {
      const s = await client.session.get({ path: { id: sessionID } });
      const main = !s.data?.parentID;
      mainSession.set(sessionID, main);
      return main;
    } catch {
      // An uncertain child must never record-human-turn human presence. Do not cache the
      // transient failure; a later event gets a fresh lookup.
      return false;
    }
  }

  return {
    "chat.message": async (
      input: { sessionID: string; agent?: string },
      output: { parts: Array<{ type?: string; text?: string }> },
    ) => {
      if (input.agent) sessionAgent.set(input.sessionID, input.agent);
      // Never treat this plugin's own continue-workflow-nudge injection as a human turn.
      const first = output.parts.find((p) => p.type === "text");
      if (first?.text?.startsWith(NUDGE_SENTINEL)) return;
      if (!(await isMainSession(input.sessionID))) return;
      sawHumanTurn.add(input.sessionID);
      if (!started.has(input.sessionID)) {
        const result = await runCore(
          "aidlc-session-start.ts",
          {
            hook_event_name: "SessionStart",
            source: "startup",
            session_id: input.sessionID,
          },
          directory,
        );
        // A fresh project has no state yet, so the core hook emits no context.
        // Retry on later human turns until an active workflow is available.
        if (sessionStartHandled(result.stdout)) started.add(input.sessionID);
        // Plugin-contributed SessionStart rows. On registry-bearing faces the
        // host merges a plugin's hooks.json alongside core's own registration;
        // opencode has no registry, so the equivalent merge happens here. The
        // composer is the row that matters most — it is what copies a plugin's
        // stages, scopes, agents and knowledge into the install, so without
        // this arm an opencode adopter installs a plugin whose content never
        // arrives.
        await Promise.all(
          pluginRowsFor("SessionStart", directory).map((row) =>
            runCore(
              row.hookFile,
              {
                hook_event_name: "SessionStart",
                source: "startup",
                session_id: input.sessionID,
              },
              directory,
            ),
          ),
        );
      }
      await runCore(
        "aidlc-record-human-turn.ts",
        {
          hook_event_name: "UserPromptSubmit",
          session_id: input.sessionID,
          prompt: first?.text ?? "",
        },
        directory,
      );
    },

    "tool.execute.before": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { args: Record<string, unknown> },
    ) => {
      const args = output.args ?? {};
      if (input.tool === "task") {
        const dispatch = await runCore(
          "aidlc-deliver-stage-rules.ts",
          {
            hook_event_name: "PreToolUse",
            session_id: input.sessionID,
            tool_name: "task",
            tool_input: args,
            cwd: directory,
          },
          directory,
        );
        if (dispatch.code === 2) {
          throw new Error(
            dispatch.stderr.trim() ||
              "required active-stage rules could not be loaded for subagent dispatch",
          );
        }
        if (dispatch.stdout.trim()) {
          try {
            const parsed = JSON.parse(dispatch.stdout) as {
              hookSpecificOutput?: {
                updatedInput?: Record<string, unknown>;
              };
            };
            if (parsed.hookSpecificOutput?.updatedInput) {
              output.args = parsed.hookSpecificOutput.updatedInput;
            }
          } catch {
            throw new Error(
              "AIDLC deliver-stage-rules hook returned invalid rewrite output",
            );
          }
        }
      }
      const namedAgent = sessionAgent.get(input.sessionID);
      const delegatedAgent =
        namedAgent?.startsWith("aidlc-") && namedAgent.endsWith("-agent")
          ? namedAgent
          : null;
      if (input.tool === "bash") {
        const command = (args.command as string) ?? "";
        const violation = aidlcBashBoundaryViolation(command, aidlcEntrypoints);
        if (violation) throw new Error(violation);
        // State-transition guard, parallel to the Claude/Kiro/Codex PreToolUse
        // wiring. The state CLI's ownership check remains the hard floor; this
        // gives the conductor the same immediate redirect the other harnesses
        // get instead of a late CLI error.
        const guard = await runCore(
          "aidlc-state-transition-guard.ts",
          {
            hook_event_name: "PreToolUse",
            tool_name: "Bash",
            tool_input: { command },
            cwd: directory,
            ...(delegatedAgent ? { agent_type: delegatedAgent } : {}),
          },
          directory,
        );
        if (guard.code === 2) {
          throw new Error(
            guard.stderr.trim() ||
              "stage status is changed by the workflow tools, not by hand: use aidlc-orchestrate.ts report instead of calling aidlc-state.ts directly",
          );
        }
      }

      // Review-freeze (§12a terminal-receipt write-freeze): runs for EVERY
      // agent - unlike reviewer-scope there is no identity gate, because any
      // produces[] write voids a fresh READY receipt regardless of who makes
      // it. The core hook self-filters to write tools and fails open.
      if (
        input.tool === "bash" ||
        input.tool === "write" ||
        input.tool === "edit" ||
        input.tool === "apply_patch"
      ) {
        const freezeCalls =
          input.tool === "bash"
            ? [{ toolName: "Bash", toolInput: { command: (args.command as string) ?? "" } }]
            : (input.tool === "apply_patch" ? applyPatchPaths(args) : [
                (args.filePath as string) ?? (args.path as string) ?? "",
              ])
                .filter((filePath) => filePath.length > 0)
                .map((filePath) => ({
                  toolName: input.tool === "edit" ? "Edit" : "Write",
                  toolInput: { file_path: filePath },
                }));
        for (const call of freezeCalls) {
          const freeze = await runCore(
            "aidlc-review-freeze.ts",
            {
              hook_event_name: "PreToolUse",
              tool_name: call.toolName,
              tool_input: call.toolInput,
              cwd: directory,
            },
            directory,
          );
          if (freeze.code === 2) {
            throw new Error(
              freeze.stderr.trim() ||
                "review-freeze: this write would invalidate a fresh READY review receipt",
            );
          }
        }
      }

      // Plan-approval guard: workspace mutations share the same normalized
      // calls as review-freeze, while task dispatches carry the explicit
      // approval target and Testing Contract markers.
      if (
        input.tool === "bash" ||
        input.tool === "write" ||
        input.tool === "edit" ||
        input.tool === "apply_patch"
      ) {
        const planCalls =
          input.tool === "bash"
            ? [{ toolName: "Bash", toolInput: { command: (args.command as string) ?? "" } }]
            : (input.tool === "apply_patch" ? applyPatchPaths(args) : [
                (args.filePath as string) ?? (args.path as string) ?? "",
              ])
                .filter((filePath) => filePath.length > 0)
                .map((filePath) => ({
                  toolName: input.tool === "edit" ? "Edit" : "Write",
                  toolInput: { file_path: filePath },
                }));
        for (const call of planCalls) {
          const guard = await runCore(
            "aidlc-plan-approval-guard.ts",
            {
              hook_event_name: "PreToolUse",
              tool_name: call.toolName,
              tool_input: call.toolInput,
              cwd: directory,
            },
            directory,
          );
          if (guard.code === 2) {
            throw new Error(
              guard.stderr.trim() ||
                "code-generation requires an approved plan before workspace mutation",
            );
          }
        }
      }

      if (input.tool === "task") {
        const target =
          (args.subagent_type as string) ?? (args.agent as string) ?? "";
        if (target === "aidlc-developer-agent") {
          const guard = await runCore(
            "aidlc-plan-approval-guard.ts",
            {
              hook_event_name: "PreToolUse",
              tool_name: "Task",
              tool_input: {
                subagent_type: target,
                prompt: [(args.prompt as string) ?? "", (args.description as string) ?? ""]
                  .filter((t) => t.length > 0)
                  .join("\n"),
              },
              cwd: directory,
            },
            directory,
          );
          if (guard.code === 2) {
            throw new Error(
              guard.stderr.trim() ||
                "code-generation requires an approved plan before dispatching the developer agent",
            );
          }
        }
      }

      // Plugin-contributed PreToolUse targets. The plugin's hook body reads the
      // same ClaudeCodeHookInput shape core hooks do, so it inherits this
      // adapter's normalisation and its reject contract (opencode blocks by
      // THROWING, not by exit code — the code-2 convention is translated here
      // exactly as it is for every core guard above).
      for (const row of pluginRowsFor("PreToolUse", directory)) {
        if (row.matcher && !matchesTool(row.matcher, input.tool)) continue;
        // A file-shaped guard expects one call per path. reviewerCalls already
        // fans a patch envelope into per-file Write calls, so reuse it and fall
        // back to the raw args for tools it does not decompose (bash, task).
        const fanned = reviewerCalls(input.tool, args);
        const payloads =
          fanned.length > 0
            ? fanned.map((call) => ({
                tool_name: call.toolName,
                tool_input: call.toolInput,
              }))
            : [{ tool_name: claudeToolName(input.tool), tool_input: args }];
        for (const payload of payloads) {
          const contributed = await runCore(
            row.hookFile,
            {
              hook_event_name: "PreToolUse",
              ...payload,
              cwd: directory,
              ...(delegatedAgent ? { agent_type: delegatedAgent } : {}),
            },
            directory,
          );
          if (contributed.code === 2)
            throw new Error(
              contributed.stderr.trim() ||
                `${row.target} denied this operation`,
            );
        }
      }

      const calls = reviewerCalls(input.tool, args);
      if (calls.length === 0) return;

      const agent = namedAgent;
      const identity =
        agent
          ? { agent_type: agent }
          : (await isMainSession(input.sessionID))
            ? null
            : { scoped_registration: true };
      if (identity === null) return;

      for (const call of calls) {
        const result = await runCore(
          "aidlc-reviewer-scope.ts",
          {
            hook_event_name: "PreToolUse",
            tool_name: call.toolName,
            tool_input: call.toolInput,
            cwd: directory,
            ...identity,
          },
          directory,
        );
        if (result.code === 2) {
          throw new Error(result.stderr.trim() || "reviewer read-scope refused this tool call");
        }
      }
    },

    "tool.execute.after": async (
      input: {
        tool: string;
        sessionID: string;
        callID: string;
        args: Record<string, unknown>;
      },
      output?: { output?: string },
    ) => {
      const { tool, args } = input;
      // Plugin-contributed PostToolUse rows run FIRST: the core arms below
      // return early per tool, so dispatching after them would silently skip
      // every plugin row on write, edit, patch and todo tools — the shape that
      // makes a registration look present while never firing.
      for (const row of pluginRowsFor("PostToolUse", directory)) {
        if (row.matcher && !matchesTool(row.matcher, tool)) continue;
        await runCore(
          row.hookFile,
          {
            hook_event_name: "PostToolUse",
            tool_name: claudeToolName(tool),
            tool_input: args,
            tool_response: output?.output ?? "",
            cwd: directory,
          },
          directory,
        );
      }
      if (tool === "write" || tool === "edit" || tool === "apply_patch") {
        const paths =
          tool === "apply_patch"
            ? applyPatchPaths(args)
            : [((args.filePath as string) ?? (args.path as string) ?? "")];
        for (const filePath of paths) {
          if (!filePath) continue;
          const absolutePath = isAbsolute(filePath) ? filePath : join(directory, filePath);
          const payload = {
            hook_event_name: "PostToolUse",
            tool_name: "Write",
            tool_input: { file_path: absolutePath },
          };
          // audit THEN sensors, mirroring the Claude settings.json order.
          await runCore("aidlc-write-audit-log.ts", payload, directory);
          await runCore("aidlc-run-sensors.ts", payload, directory);
        }
        return;
      }
      if (tool === "bash") {
        const payload = {
          hook_event_name: "PostToolUse",
          tool_name: "Bash",
          tool_input: { command: (args.command as string) ?? "" },
          session_id: input.sessionID,
          tool_response: output?.output ?? "",
        };
        await runCore("aidlc-rebuild-stage-graph.ts", payload, directory);
        return;
      }
      if (tool === "todowrite") {
        // The core hook keys on Claude's TaskUpdate in_progress transition;
        // map the first in-progress todo's content onto activeForm.
        const todos = (args.todos as Array<{ content?: string; status?: string }>) ?? [];
        const active = todos.find((t) => t.status === "in_progress");
        if (!active?.content) return;
        await runCore(
          "aidlc-sync-workflow-state.ts",
          {
            hook_event_name: "PostToolUse",
            tool_name: "TaskUpdate",
            tool_input: { status: "in_progress", activeForm: active.content },
          },
          directory,
        );
        return;
      }
      if (tool === "task") {
        const subagentStop = {
          hook_event_name: "SubagentStop",
          session_id: input.sessionID,
          agent_type:
            (args.subagent_type as string) ?? (args.agent as string) ?? "unknown",
          agent_id: input.callID,
        };
        await runCore("aidlc-log-subagent.ts", subagentStop, directory);
        // Contributed SubagentStop hooks see the SAME payload core's does. The
        // event cannot block, so each runs for its side effect and its exit code
        // is not a verdict.
        for (const row of pluginRowsFor("SubagentStop", directory)) {
          await runCore(row.hookFile, subagentStop, directory);
        }
      }
    },

    "experimental.session.compacting": async (_input: { sessionID: string }) => {
      await runCore("aidlc-validate-state.ts", { hook_event_name: "PreCompact" }, directory);
    },

    event: async ({ event }: { event: { type: string; properties?: Record<string, unknown> } }) => {
      if (event.type !== "session.idle") return;
      const sessionID = (event.properties?.sessionID as string) ?? "";
      // A workflow can be created during the first turn, after session-start saw
      // no state. Let the core Stop hook's own state-file guard decide.
      if (!sessionID || !sawHumanTurn.has(sessionID)) return;
      if (!(await isMainSession(sessionID))) return;
      if (idleInFlight.has(sessionID)) return;
      idleInFlight.add(sessionID);
      // opencode provides no stop_hook_active flag and no transcript, so the
      // core hook's run-mode-aware no-progress ceiling is the loop guard here
      // (same degradation profile as Kiro). The absent transcript no longer makes
      // the conversational carve-out inert: the core hook falls back to the
      // `.aidlc-engine/human-turn` / `.aidlc-engine/engine-touch` mtime comparison, and the
      // chat.message arm's aidlc-record-human-turn.ts forward writes the former.
      let nudgeReason: string | null = null;
      try {
        const res = await runCore(
          "aidlc-continue-workflow.ts",
          {
            hook_event_name: "Stop",
            stop_hook_active: false,
            session_id: sessionID,
          },
          directory,
        );
        try {
          const parsed = JSON.parse(res.stdout) as { decision?: string; reason?: string };
          if (parsed.decision === "block" && parsed.reason) {
            nudgeReason = parsed.reason;
          }
        } catch {
          /* no/unparseable output → allow the continue-workflow (advisory) */
        }
      } finally {
        idleInFlight.delete(sessionID);
      }
      // Release serialization before the prompt: OpenCode may synchronously
      // deliver the continuation's next idle while this promise is pending.
      if (nudgeReason) {
        await client.session.prompt({
          path: { id: sessionID },
          body: { parts: [{ type: "text", text: `${NUDGE_SENTINEL} ${nudgeReason}` }] },
        });
      }
    },
  };
};
