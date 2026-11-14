import { stringify } from "smol-toml";
import { accepted, refused, type Result } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { CopyChannelAllows } from "../../../projection/application/ports/copy-channel.ts";
import type { HostSettingsRenderer, SettingsCapabilities } from "../../../projection/application/ports/settings.ts";
import type { Rendering } from "../../../projection/application/ports/harness.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";
import type { RenderedConcept } from "../../../projection/domain/projected-file.ts";
import { HOOK_WIRING, type CodexHookEvent } from "./hook-wiring.ts";

type SettingsFailure = Extract<ProjectionRefusal, { readonly kind: "render-failed" }>;
type HookCommand = { readonly harnessName: string; readonly invoke: string; readonly trustedNamespace: string };

export const CODEX_SETTINGS_INPUTS = [] as const;

const adapterCmd = ({ harnessName, target, trustedNamespace }: { harnessName: string; target: string; trustedNamespace: string }) => `{{INVOKE}} ${trustedNamespace} adapter ${harnessName} ${target}`;

function hookTimeoutSeconds(target: string, capabilities: SettingsCapabilities): number {
  const ordinary = capabilities.extendedSubprocessTimeoutMs / 1000;
  return target === "continue-workflow" || target === "audit-and-sensors"
    ? ordinary * 2
    : ordinary;
}

function emitHooksJson({ invoke, harnessName, trustedNamespace }: HookCommand, capabilities: SettingsCapabilities): string {
  const hooks = HOOK_WIRING.reduce<Record<string, readonly Record<string, unknown>[]>>(
    (groups, { event, matcher, target }) => ({
      ...groups,
      [event]: [...(groups[event] ?? []), {
        hooks: [{
          type: "command",
          command: adapterCmd({ harnessName, target, trustedNamespace }).replace("{{INVOKE}}", invoke),
          timeout: hookTimeoutSeconds(target, capabilities),
        }],
        ...(matcher ? { matcher } : {}),
      }],
    }),
    {},
  );
  return `${JSON.stringify({ hooks }, null, 2)  }\n`;
}

function renderRules({ harnessDir, channel, trustedNamespace, toolScripts }: { readonly harnessDir: string; readonly channel: "copy" | "native"; readonly trustedNamespace: string; readonly toolScripts: readonly string[] }): string {
  const trustedPattern = ["aidlc", trustedNamespace]
    .map((token) => JSON.stringify(token))
    .join(", ");
  const enginePattern = ["bun", `${harnessDir}/tools/aidlc.ts`, trustedNamespace]
    .map((token) => JSON.stringify(token))
    .join(", ");
  const scripts = toolScripts
    .map((script) => `    ${JSON.stringify(`${harnessDir}/tools/${script}`)}`)
    .join(",\n");
  const runtimeRules = channel === "native"
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

export function emitDefaultRules({ harnessDir, invoke, trustedNamespace }: {
  readonly harnessDir: string; readonly invoke: string; readonly trustedNamespace: string;
}, allows: Result<CopyChannelAllows, SettingsFailure>): Result<string, SettingsFailure> {
  if (!allows.ok) return allows;
  return accepted(renderRules({ harnessDir, channel: invoke === "aidlc" ? "native" : "copy",
    trustedNamespace, toolScripts: allows.value.toolScripts }));
}
const SNAKE: Record<CodexHookEvent, string> = {
  ["SessionStart"]: "session_start",
  ["UserPromptSubmit"]: "user_prompt_submit",
  ["PreToolUse"]: "pre_tool_use",
  ["PostToolUse"]: "post_tool_use",
  ["PermissionRequest"]: "permission_request",
  ["PreCompact"]: "pre_compact",
  ["SubagentStart"]: "subagent_start",
  ["SubagentStop"]: "subagent_stop",
  ["Stop"]: "stop",
};

type TrustState = {
  readonly counters: Readonly<Record<string, number>>;
  readonly state: Readonly<Record<string, { readonly ["trusted_hash"]: string }>>;
};

export function trustEntries({ hooksJsonPath, harnessName, invoke, trustedNamespace }: {
  readonly hooksJsonPath: string;
  readonly harnessName: string;
  readonly invoke: string;
  readonly trustedNamespace: string | undefined;
}, capabilities: SettingsCapabilities): Result<string, SettingsFailure> {
  if (!trustedNamespace) return refused({ kind: "render-failed", concept: "hook-registration",
    name: "hooks.json", reason: "trusted route namespace is required" });
  const entries = HOOK_WIRING.reduce<Result<TrustState, SettingsFailure>>(
    (trustState, { event, matcher, target }) => {
      if (!trustState.ok) return trustState;
      const snake = SNAKE[event];
      const idx = trustState.value.counters[snake] ?? 0;
      const command = adapterCmd({ harnessName, target, trustedNamespace })
        .replace("{{INVOKE}}", invoke);
      const timeout = hookTimeoutSeconds(target, capabilities);
      try {
        const hash = capabilities.hookTrust({ event: snake, command, timeoutSeconds: timeout, matcher });
        return accepted({
          counters: { ...trustState.value.counters, [snake]: idx + 1 },
          state: { ...trustState.value.state, [`${hooksJsonPath}:${snake}:${idx}:0`]: { ["trusted_hash"]: hash } },
        });
      } catch (error) {
        return refused({ kind: "render-failed", concept: "hook-registration", name: "hooks.json",
          reason: error instanceof Error ? error.message : String(error) });
      }
    },
    accepted({ counters: {}, state: {} }),
  );
  if (!entries.ok) return entries;
  try {
    return accepted(stringify({ hooks: { state: entries.value.state } }));
  } catch (error) {
    return refused({ kind: "render-failed", concept: "hook-registration", name: "hooks.json",
      reason: error instanceof Error ? error.message : String(error) });
  }
}

export function emitTrustSeed({ harnessDir, harnessName, invoke, trustedNamespace }: Omit<HookCommand, "trustedNamespace"> & { readonly harnessDir: string; readonly trustedNamespace: string | undefined }, capabilities: SettingsCapabilities): Result<string, SettingsFailure> {
  const entries = trustEntries({ hooksJsonPath: `<PROJECT_DIR>/${harnessDir}/hooks.json`,
    harnessName, invoke, trustedNamespace }, capabilities);
  if (!entries.ok) return entries;
  const recipe = `# This template hashes the projected \`${invoke} ${trustedNamespace} adapter ${harnessName} ...\`
# commands in hooks.json. Start one interactive Codex session and choose
# "Trust all and continue" to register the project-specific hook identities.
`;
  return accepted(
    `# dist/codex hook-trust pre-seed (S9a) — TEMPLATE.\n${ 
    recipe 
    }# Paste the complete stdout into the USER config.toml ($CODEX_HOME/config.toml).\n` +
    `# If entries for that hooks.json path already exist, replace the full set;\n` +
    `# appending a second set creates invalid TOML. The hash covers the\n` +
    `# normalized hook identity (event + matcher + command + defaults), NOT the path;\n` +
    `# only the key changes per install. Codex then runs the hooks without a\n` +
    `# TUI trust pass (the --dangerously-bypass-hook-trust flag does NOT fire\n` +
    `# untrusted hooks at 0.137-0.139; never rely on it).\n\n${ 
    entries.value}`
  );
}

const file = ({ name, text, concept }: { name: string; text: string; concept: RenderedConcept }): Rendering => {
  const path = projectPath(`.codex/${name}`);
  if (!path.ok) return refused({ kind: "render-failed", concept, name,
    reason: "The settings destination must be project-relative." });
  return accepted([{ path: path.value, content: { kind: "text", text },
    mode: "regular", origin: { kind: "rendered", concept, name } }]);
};

const hookFiles = ({ harnessDir, invoke, trustedNamespace, harnessName }: HookCommand & { readonly harnessDir: string }, capabilities: SettingsCapabilities): Rendering => {
      const hooks = file({ name: "hooks.json", text: emitHooksJson({ invoke, harnessName, trustedNamespace }, capabilities), concept: "hook-registration" });
      if (!hooks.ok) return hooks;
      const seedText = emitTrustSeed({ harnessDir, harnessName, invoke, trustedNamespace }, capabilities);
      if (!seedText.ok) return seedText;
      const seed = file({ name: "trust-seed.toml", text: seedText.value, concept: "hook-registration" });
      if (!seed.ok) return seed;
      return accepted([...hooks.value, ...seed.value]);
};

export const createCodexSettingsRenderer: HostSettingsRenderer = (inputs) => ({
  renderSettings: () => {
    const harnessDir = inputs.tokens.HARNESS_DIR;
    const trustedNamespace = inputs.tokens.TRUSTED_NAMESPACE;
    if (harnessDir === null || !trustedNamespace) return refused({ kind: "render-failed",
      concept: "settings", name: "rules/default.rules", reason: "trusted route namespace and harness directory are required" });
    return file({ name: "rules/default.rules", text: renderRules({ harnessDir, channel: inputs.channel,
      trustedNamespace, toolScripts: inputs.allows.toolScripts }), concept: "settings" });
  },
  renderHookRegistrations: () => {
    const harnessDir = inputs.tokens.HARNESS_DIR;
    const invoke = inputs.tokens.INVOKE;
    const trustedNamespace = inputs.tokens.TRUSTED_NAMESPACE;
    if (harnessDir === null || invoke === null || !trustedNamespace) return refused({ kind: "render-failed",
      concept: "hook-registration", name: "hooks.json", reason: "trusted route namespace, invocation and harness directory are required" });
    return hookFiles({ harnessDir, invoke, trustedNamespace, harnessName: "codex" }, inputs);
  },
});