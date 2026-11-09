// harness/codex/emit.ts — the Codex CLI per-shell emission plugin.
//
// The harness-dir token / anchored-prefix transform is exposed via
// ctx.substituteToken, plus a local aidlc-rules rename mirroring the
// packager's (rewriteProse).

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, posix, win32 } from "node:path";
import { stringify } from "smol-toml";
import type { EmitContext } from "../../scripts/manifest-types.ts";
import {
  absorbReviewerKnowledge,
  injectDelegatedKnowledgePreflight,
} from "../../scripts/agent-knowledge.ts";
import { copyChannelToolScripts } from "../../core/tools/aidlc.ts";
import { codexHookTrustHash } from "../../core/tools/aidlc-command.ts";
import { accepted } from "../../src/kernel/result.ts";
import { createCodexAgentRenderer } from "../../src/hosts/codex/projection/agent-renderer.ts";
import { codexCommandPath } from "../../src/hosts/codex/projection/command-renderer.ts";
import { EXTENDED_SUBPROCESS_TIMEOUT_MS } from "../../core/tools/aidlc-runtime-budget.ts";
import {
  modelAgentName,
  resolveModelPolicy,
  writeCodexAgentSurface,
  writeMarkdownAgentSurface,
} from "../../core/tools/aidlc-model-policy.ts";

// ---------------------------------------------------------------------------
// Hook wiring (kiro-normative shape: register ONLY events with a real core-hook
// consumer; dropped hooks ship unregistered).
// ---------------------------------------------------------------------------
const HOOK_WIRING: Array<{ event: string; matcher?: string; target: string }> = [
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

const adapterCmd = (
  harnessName: string,
  target: string,
  trustedNamespace: string,
) => `{{INVOKE}} ${trustedNamespace} adapter ${harnessName} ${target}`;

// Codex command-hook `timeout` is in seconds, including in the canonical trust
// identity. Stop and sensor fanout get an enclosing budget for compound work.
function hookTimeoutSeconds(target: string): number {
  const ordinary = EXTENDED_SUBPROCESS_TIMEOUT_MS / 1000;
  return target === "continue-workflow" || target === "audit-and-sensors"
    ? ordinary * 2
    : ordinary;
}

function emitHooksJson(
  substituteToken: (value: string) => string,
  harnessName: string,
  trustedNamespace: string,
): string {
  const hooks: Record<string, Array<Record<string, unknown>>> = {};
  for (const { event, matcher, target } of HOOK_WIRING) {
    const group: Record<string, unknown> = {
      hooks: [{
        type: "command",
        command: substituteToken(adapterCmd(harnessName, target, trustedNamespace)),
        timeout: hookTimeoutSeconds(target),
      }],
    };
    if (matcher) group.matcher = matcher;
    hooks[event] ??= [];
    hooks[event].push(group);
  }
  return JSON.stringify({ hooks }, null, 2) + "\n";
}

function emitConfigToml(onboarding: string): string {
  if (onboarding.includes("'''")) {
    throw new Error("Codex onboarding contains the TOML multiline literal delimiter (''').");
  }
  return `# dist/codex shipped config — project-scoped; copy into .codex/config.toml
# of a trusted project. Do not merge this file into ~/.codex/config.toml:
# developer_instructions carries this project's AI-DLC onboarding.

# AI-DLC Codex onboarding, injected into every session (same content as .codex/onboarding.md).
developer_instructions = '''
${onboarding}'''

# Model/provider: intentionally omitted. The project inherits the provider,
# authentication, model, context window, and reasoning effort selected in the
# user's Codex configuration. Agent roles also inherit that model; balanced
# reviewers retain only their medium reasoning-effort cap.

# Tool output budget. Codex cuts a shell result at 10,000 tokens (about 40 KB)
# for the models in its catalog but at 10,000 BYTES for a model it does not
# know (custom providers, --oss). AIDLC prints a workflow instruction of up to
# 28 KiB as one shell result, so the budget is raised for every model.
tool_output_token_limit = 20000

# Sandbox: workspace-write keeps <workspace>/.git read-only BY DESIGN;
# interactive sessions escalate (deny -> approve -> retry unsandboxed) and the
# shipped rules/default.rules pre-allows git worktree/commit/add prefixes so
# escalations vanish. HEADLESS runs (CI, test drivers)
# cannot escalate: uncomment writable_roots with the MAIN repo's absolute
# .git path (linked worktrees resolve into <main>/.git/worktrees/*).
sandbox_mode = "workspace-write"

# Gates use Codex's structured question picker (request_user_input), which
# Codex still marks as under development; [features] below turns it on. Codex
# then warns at every start and points at ~/.codex/config.toml, so this turns
# that warning off. It also hides the warning for any other under-development
# feature while you work in this project. For numbered prose gates in one
# session, start Codex with -c features.default_mode_request_user_input=false.
suppress_unstable_features_warning = true

# The AIDLC method (the markdown rule layers: org/team/project + phases/) lives
# at the workspace root under aidlc/spaces/<space>/memory/, the single
# hand-editable source of truth, identical on every harness (NOT a per-harness
# copy under .codex/). Codex has no ambient include for it: the engine reads the
# active space's files and hands each step its rules. Codex also auto-merges
# the root AGENTS.md. (.codex/rules/ remains Codex's native Starlark
# permission-rules dir, D-10, distinct from the AIDLC method.)

[sandbox_workspace_write]
network_access = true
# writable_roots = ["/absolute/path/to/main-repo/.git"]

# Delegated roles are leaves. The conductor owns every spawn and agents cannot
# recursively delegate.
[agents]
max_depth = 1

# Gates (D-3 both-track): prose gates are the floor; these flags enable the
# structured request_user_input tool (verified working at 0.137.0+; the
# default-mode flag is still under development at 0.160.0, and its start-up
# warning is turned off above).
[tools]
experimental_request_user_input = { enabled = true }

[features]
default_mode_request_user_input = true

# Release 2.11.0 shipped AIDLC_RULES_DIR in this table, pointed at a space, and
# its own refresh of a copied project cannot take one member out of the table,
# so the member stays, empty: the engine reads an empty AIDLC_RULES_DIR as none.
# It can go when no supported project refreshes with a 2.11.0 tool.
[shell_environment_policy]
set = { AIDLC_RULES_DIR = "" }
`;
}

export function emitDefaultRules(
  harnessDir: string,
  invoke: string,
  trustedNamespace: string,
): string {
  const trustedPattern = ["aidlc", trustedNamespace]
    .map((token) => JSON.stringify(token))
    .join(", ");
  // Codex compares whole words, so the copy channel names the dispatcher's
  // engine namespace and each tool script a copy channel pre-approves
  // (copyChannelToolScripts), as AI-DLC runs them. An allowed command also runs
  // outside the sandbox; a config change and a script behind a machine-changing
  // command stay in it and get Codex's own ask.
  const enginePattern = ["bun", `${harnessDir}/tools/aidlc.ts`, trustedNamespace]
    .map((token) => JSON.stringify(token))
    .join(", ");
  const scripts = copyChannelToolScripts()
    .map((script) => `    ${JSON.stringify(`${harnessDir}/tools/${script}`)}`)
    .join(",\n");
  const runtimeRules = invoke === "aidlc"
    ? `# Native runtime allowlist: framework commands invoke the self-contained binary.
prefix_rule(pattern = [${trustedPattern}], decision = "allow")`
    : `# Bun copy-channel allowlist: AI-DLC's engine commands and its tool scripts.
prefix_rule(pattern = [${enginePattern}], decision = "allow")
prefix_rule(pattern = ["bun", [
${scripts}
]], decision = "allow")`;
  return `# dist/codex shipped permission rules (Starlark) — ${harnessDir}/rules/ is
# Codex's NATIVE rules dir (this file), distinct from the AIDLC markdown rule
# layers at ${harnessDir}/aidlc-rules/ (D-10 rename).
#
${runtimeRules}

# Git allow-rules (S9d): workspace-write keeps .git read-only in-sandbox and
# routes git writes through escalation; these prefix rules pre-approve the
# retry-unsandboxed step so Bolt worktree/commit flows run friction-free.
prefix_rule(pattern = ["git", "worktree"], decision = "allow")
prefix_rule(pattern = ["git", "commit"], decision = "allow")
prefix_rule(pattern = ["git", "add"], decision = "allow")
`;
}

const SNAKE: Record<string, string> = {
  SessionStart: "session_start",
  UserPromptSubmit: "user_prompt_submit",
  PreToolUse: "pre_tool_use",
  PostToolUse: "post_tool_use",
  PermissionRequest: "permission_request",
  PreCompact: "pre_compact",
  SubagentStart: "subagent_start",
  SubagentStop: "subagent_stop",
  Stop: "stop",
};

// Trust entries keyed on "<abs hooks.json path>:<event_snake>:<group>:<idx>".
// Exported so the `trust` subcommand (scripts/package.ts) can print
// installer-substituted entries.
export function trustEntries(
  projectDir: string,
  hooksJsonPath?: string,
  harnessDir = ".codex",
  harnessName = "codex",
  invoke = "aidlc",
  trustedNamespace?: string,
): string {
  if (!trustedNamespace) throw new Error("trusted route namespace is required");
  // A supplied hooks path is already the Codex trust identity: preserve it
  // exactly. For the default, choose the path implementation from the project
  // spelling so Windows installers can generate native paths even when this
  // packager is invoked from Unix (and vice versa).
  const projectPath =
    win32.isAbsolute(projectDir) &&
    (!posix.isAbsolute(projectDir) || projectDir.startsWith("//"))
      ? win32
      : posix;
  const path = hooksJsonPath ?? projectPath.join(projectDir, harnessDir, "hooks.json");
  const counters: Record<string, number> = {};
  const state: Record<string, { trusted_hash: string }> = {};
  for (const { event, matcher, target } of HOOK_WIRING) {
    const snake = SNAKE[event];
    const idx = counters[snake] ?? 0;
    counters[snake] = idx + 1;
    const command = adapterCmd(harnessName, target, trustedNamespace)
      .replace("{{INVOKE}}", invoke);
    const hash = codexHookTrustHash(snake, command, hookTimeoutSeconds(target), matcher);
    state[`${path}:${snake}:${idx}:0`] = { trusted_hash: hash };
  }
  return stringify({ hooks: { state } });
}

export function emitTrustSeed(
  harnessDir: string,
  harnessName = "codex",
  invoke = "aidlc",
  trustedNamespace?: string,
): string {
  if (!trustedNamespace) throw new Error("trusted route namespace is required");
  const recipe = `# This template hashes the projected \`${invoke} ${trustedNamespace} adapter ${harnessName} ...\`
# commands in hooks.json. Start one interactive Codex session and choose
# "Trust all and continue" to register the project-specific hook identities.
`;
  return (
    `# dist/codex hook-trust pre-seed (S9a) — TEMPLATE.\n` +
    recipe +
    `# Paste the complete stdout into the USER config.toml ($CODEX_HOME/config.toml).\n` +
    `# If entries for that hooks.json path already exist, replace the full set;\n` +
    `# appending a second set creates invalid TOML. The hash covers the\n` +
    `# normalized hook identity (event + matcher + command + defaults), NOT the path;\n` +
    `# only the key changes per install. Codex then runs the hooks without a\n` +
    `# TUI trust pass (the --dangerously-bypass-hook-trust flag does NOT fire\n` +
    `# untrusted hooks at 0.137-0.139; never rely on it).\n\n` +
    trustEntries(
      "<PROJECT_DIR>",
      undefined,
      harnessDir,
      harnessName,
      invoke,
      trustedNamespace,
    )
  );
}

// ---------------------------------------------------------------------------
// emit() — the manifest entry point. Assembles every codex-only emission as a
// {path, content} list, then writes it into the packager-provided dist root.
// ---------------------------------------------------------------------------
function emit(ctx: EmitContext): void {
  // tierCap is the packager's resolved pack-time cap, passed through so the
  // emit-owned TOML projections use the SAME cap as every declarative
  // projection - never re-resolved here.
  const {
    coreRoot,
    harnessName,
    distRoot,
    harnessDir,
    trustedRouteNamespace,
    substituteToken,
    tierCap,
  } = ctx;
  const invoke = substituteToken("{{INVOKE}}");
  const CODEX_ROOT = join(distRoot, harnessDir);
  const SKILLS_DST = join(distRoot, ".agents", "skills");

  // The codex anchored transform: token/prefix substitution (.codex) THEN the
  // aidlc-rules rename — mirrors the packager's transform for prose the emit
  // layer generates from core sources (agent bodies and runner prose).
  const rewriteProse = (s: string): string =>
    substituteToken(s).replaceAll(`${harnessDir}/rules/`, `${harnessDir}/aidlc-rules/`);

  const onboarding = readFileSync(join(CODEX_ROOT, "onboarding.md"), "utf-8")
    .replaceAll(`${harnessDir}/skills/`, ".agents/skills/");
  const emissions: Array<{ path: string; content: () => string }> = [];

  // codex-only config + wiring + trust + native onboarding skills paths
  emissions.push({
    path: join(CODEX_ROOT, "hooks.json"),
    content: () =>
      emitHooksJson(substituteToken, harnessName, trustedRouteNamespace),
  });
  emissions.push({
    path: join(CODEX_ROOT, "config.toml"),
    content: () => emitConfigToml(onboarding),
  });
  emissions.push({
    path: join(CODEX_ROOT, "rules", "default.rules"),
    content: () =>
      emitDefaultRules(harnessDir, invoke, trustedRouteNamespace),
  });
  emissions.push({
    path: join(CODEX_ROOT, "trust-seed.toml"),
    content: () =>
      emitTrustSeed(harnessDir, harnessName, invoke, trustedRouteNamespace),
  });
  emissions.push({
    path: join(CODEX_ROOT, "onboarding.md"),
    content: () => onboarding,
  });

  const agents = ctx.method.agents.toSorted((left, right) => left.slug.localeCompare(right.slug));
  for (const agent of agents) {
    const captured = ctx.sources.find((source) =>
      source.owner.kind === "core" && source.path === agent.source);
    if (!captured) {
      throw new Error(`Core agent ${agent.slug} requires its captured authored text.`);
    }
    const authored = captured.content.kind === "text"
      ? captured.content.text : Buffer.from(captured.content.bytes).toString("utf-8");
    if (agent.model.kind !== "tier") {
      throw new Error(`Core agent ${agent.slug} requires an authored tier.`);
    }
    const effective = resolveModelPolicy(
      null, modelAgentName(`${agent.slug}.md`), agent.model.tier, "codex", tierCap,
    );
    const prepareProse = (prose: string): string => rewriteProse(injectDelegatedKnowledgePreflight(
      absorbReviewerKnowledge({ content: prose, agentName: agent.slug,
        sourceRoot: coreRoot, reviewerAgents: ctx.reviewerAgents }), agent.slug, harnessDir,
    ));
    const legacy: Parameters<typeof createCodexAgentRenderer>[0] = {
      markdownSurface: () => accepted(writeMarkdownAgentSurface(
        prepareProse(authored), effective, { effortKey: "effort" },
      )),
      codexSurface: (request) => accepted(writeCodexAgentSurface(request.content, effective)),
      preparePersona: (source) => prepareProse(source.persona.text),
    };
    const rendering = createCodexAgentRenderer(legacy)({ agent, knowledge: ctx.method.knowledge });
    if (!rendering.ok) throw new Error(JSON.stringify(rendering.refusal));
    for (const file of rendering.value) {
      if (file.content.kind !== "text") {
        throw new Error(`Codex emitted non-text content for ${agent.slug}`);
      }
      const text = file.content.text;
      emissions.push({ path: join(distRoot, file.path), content: () => text });
    }
  }

  // Clean-sweep the emitted skills tree so a removed runner doesn't linger.
  // In --check mode distRoot is temporary; the packager compares its complete
  // inventory with the independently generated counterpart after emit returns.
  rmSync(SKILLS_DST, { recursive: true, force: true });
  for (const { path, content } of emissions) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content(), "utf-8");
  }
  ctx.emitCommands(codexCommandPath);
}

export default emit;
