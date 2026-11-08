import { stringify } from "smol-toml";
import { emitHooksJson, hookTrustState, resolveCodexHookPlan, type CodexHookPlan, type CodexRuntimeBinding } from "./hook-plan.ts";
import { codexTrustPath } from "./trust-path.ts";

export function emitConfigToml(onboarding: string): string {
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

export function emitDefaultRules({ binding: { harnessDir, invoke, trustedNamespace }, toolScripts }: { readonly binding: CodexRuntimeBinding; readonly toolScripts: readonly string[] }): string {
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
  const scripts = toolScripts
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

export function emitTrustSeed({ binding, plan = resolveCodexHookPlan({ binding }) }: { readonly binding: CodexRuntimeBinding; readonly plan?: CodexHookPlan }): string {
  const { harnessDir, harnessName, invoke, trustedNamespace } = binding;
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
    stringify({ hooks: { state: hookTrustState({ plan, hooksJsonPath: codexTrustPath({ projectDir: "<PROJECT_DIR>", harnessDir }) }) } })
  );
}

export const trustEntries = ({ projectDir, hooksJsonPath, binding }: { readonly projectDir: string; readonly hooksJsonPath?: string | undefined; readonly binding: CodexRuntimeBinding }): string => {
  if (!binding.trustedNamespace) throw new Error("trusted route namespace is required");
  return stringify({ hooks: { state: hookTrustState({ plan: resolveCodexHookPlan({ binding }), hooksJsonPath: codexTrustPath({ projectDir, hooksJsonPath, harnessDir: binding.harnessDir }) }) } });
};

export const prepareCodexSettings = ({ binding, onboarding, toolScripts }: { readonly binding: CodexRuntimeBinding; readonly onboarding: string; readonly toolScripts: readonly string[] }) => {
  const plan = resolveCodexHookPlan({ binding });
  return { hooksJson: emitHooksJson(plan), configToml: emitConfigToml(onboarding), defaultRules: emitDefaultRules({ binding, toolScripts }), trustSeed: emitTrustSeed({ binding, plan }) };
};
