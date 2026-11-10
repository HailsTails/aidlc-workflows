// harness/codex/emit.ts — the Codex CLI per-shell emission plugin.
//
// The harness-dir token / anchored-prefix transform is exposed via
// ctx.substituteToken, plus a local aidlc-rules rename mirroring the
// packager's (rewriteProse).

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, posix, win32 } from "node:path";
import type { EmitContext } from "../../scripts/manifest-types.ts";
import {
  absorbReviewerKnowledge,
  injectDelegatedKnowledgePreflight,
} from "../../scripts/agent-knowledge.ts";
import { createCopyChannelAllowSource } from "../../src/projection/adapters/legacy-dispatcher.ts";
import { codexHookTrustHash } from "../../src/projection/adapters/legacy-trusted-commands.ts";
import { accepted } from "../../src/kernel/result.ts";
import { createCodexAgentRenderer } from "../../src/hosts/codex/projection/agent-renderer.ts";
import { codexCommandPath } from "../../src/hosts/codex/projection/command-renderer.ts";
import { extendedSubprocessTimeoutMs } from "../../src/projection/adapters/legacy-runtime-budget.ts";
import {
  emitDefaultRules as renderDefaultRules,
  emitTrustSeed as renderTrustSeed,
  trustEntries as renderTrustEntries,
} from "../../src/hosts/codex/projection/settings-renderer.ts";
import {
  modelAgentName,
  resolveModelPolicy,
  writeCodexAgentSurface,
  writeMarkdownAgentSurface,
} from "../../core/tools/aidlc-model-policy.ts";

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

// Compatibility only; removed with F3's retained emitter deletion.
export function emitDefaultRules(harnessDir: string, invoke: string, trustedNamespace: string): string {
  const result = renderDefaultRules({ harnessDir, invoke, trustedNamespace }, createCopyChannelAllowSource().read());
  if (!result.ok) throw new Error(result.refusal.reason);
  return result.value;
}
export function emitTrustSeed(harnessDir: string, harnessName = "codex", invoke = "aidlc", trustedNamespace?: string): string {
  const result = renderTrustSeed({ harnessDir, harnessName, invoke, trustedNamespace }, {
    extendedSubprocessTimeoutMs: extendedSubprocessTimeoutMs(),
    hookTrust: ({ event, command, timeoutSeconds, matcher }) =>
      codexHookTrustHash(event, command, timeoutSeconds, matcher),
  });
  if (!result.ok) throw new Error(result.refusal.reason);
  return result.value;
}
export function trustEntries(
  projectDir: string,
  hooksJsonPath?: string,
  harnessDir = ".codex",
  harnessName = "codex",
  invoke = "aidlc",
  trustedNamespace?: string,
): string {
  const projectPath = win32.isAbsolute(projectDir) &&
    (!posix.isAbsolute(projectDir) || projectDir.startsWith("//")) ? win32 : posix;
  const result = renderTrustEntries({ hooksJsonPath: hooksJsonPath ?? projectPath.join(projectDir, harnessDir, "hooks.json"),
    harnessName, invoke, trustedNamespace }, {
    extendedSubprocessTimeoutMs: extendedSubprocessTimeoutMs(),
    hookTrust: ({ event, command, timeoutSeconds, matcher }) =>
      codexHookTrustHash(event, command, timeoutSeconds, matcher),
  });
  if (!result.ok) throw new Error(result.refusal.reason);
  return result.value;
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
    distRoot,
    harnessDir,
    substituteToken,
    tierCap,
  } = ctx;
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
    path: join(CODEX_ROOT, "config.toml"),
    content: () => emitConfigToml(onboarding),
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
