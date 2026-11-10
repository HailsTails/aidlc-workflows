// harness/codex/emit.ts — the Codex CLI per-shell emission plugin.
//
// The harness-dir token / anchored-prefix transform is exposed via
// ctx.substituteToken, plus a local aidlc-rules rename mirroring the
// packager's (rewriteProse).

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
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
  const SKILLS_DST = join(distRoot, ".agents", "skills");

  // The codex anchored transform: token/prefix substitution (.codex) THEN the
  // aidlc-rules rename — mirrors the packager's transform for prose the emit
  // layer generates from core sources (agent bodies and runner prose).
  const rewriteProse = (s: string): string =>
    substituteToken(s).replaceAll(`${harnessDir}/rules/`, `${harnessDir}/aidlc-rules/`);

  const emissions: Array<{ path: string; content: () => string }> = [];

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
