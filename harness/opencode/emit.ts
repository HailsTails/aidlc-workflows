// harness/opencode/emit.ts — the opencode per-shell emission plugin.
//
//   - .opencode/agents/aidlc-*-agent.md — the 14 personas as native opencode
//     subagents: core frontmatter with the `tier:` line projected to the
//     opencode-native `model:`/`variant:` keys plus an added `mode: subagent`
//     (so none registers as a primary agent), body token-substituted → .aidlc.
//   - .opencode/command/aidlc.md — the user-invoked /aidlc entry (authored).
//   - .opencode/plugin/aidlc-opencode-adapter.ts — the hook adapter (authored;
//     opencode auto-discovers plugins from .opencode/plugin/).
//
// WHY the engine is NOT inside .opencode/: opencode auto-imports every *.ts
// under .opencode/tools/ and .opencode/tool/ as custom tool definitions, and
// importing a CLI-style script (top-level argv dispatch, process.exit) crashes
// the session (live-reproduced). The engine tree therefore ships at .aidlc/,
// which opencode never scans; the shipped opencode.json registers
// `skills.paths: [".aidlc/skills"]` for skill discovery there.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { EmitContext } from "../../scripts/manifest-types.ts";
import { createOpenCodeAgentRenderer } from "../../src/hosts/opencode/projection/agent-renderer.ts";
import { openCodeCommandPath } from "../../src/hosts/opencode/projection/command-renderer.ts";
import { accepted, refused } from "../../src/kernel/result.ts";
import type { ProjectionRefusal } from "../../src/projection/domain/projection.ts";
import {
  absorbReviewerKnowledge,
  injectDelegatedKnowledgePreflight,
} from "../../scripts/agent-knowledge.ts";
import {
  modelAgentName,
  resolveModelPolicy,
  writeMarkdownAgentSurface,
} from "../../core/tools/aidlc-model-policy.ts";

// A persona reads the method from the engine's copy of the active space's
// memory (aidlc-includes.ts ACTIVE_MEMORY_DIR), the same fixed path on every
// install, so a space switch rewrites no persona file.
function projectActiveMemoryReferences(raw: string): string {
  return raw
    .replaceAll("aidlc/spaces/<active-space>/memory/", "aidlc/active-memory/")
    .replaceAll(".aidlc/rules/aidlc-org.md", "aidlc/active-memory/org.md")
    .replaceAll(".aidlc/rules/aidlc-team.md", "aidlc/active-memory/team.md")
    .replaceAll(".aidlc/rules/aidlc-project.md", "aidlc/active-memory/project.md")
    .replaceAll(".aidlc/rules/", "aidlc/active-memory/");
}

function embedShippedEntrypoints(raw: string, distRoot: string): string {
  const marker = "/* @aidlc-shipped-entrypoints@ */ []";
  const entries = ["hooks", "tools"]
    .flatMap((dir) =>
      readdirSync(join(distRoot, ".aidlc", dir), { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
        .map((entry) => `${dir}/${entry.name}`),
    )
    .sort();
  if (!raw.includes(marker)) {
    throw new Error("opencode adapter is missing its shipped-entrypoint emission marker.");
  }
  const rendered = JSON.stringify(entries, null, 2)
    .split("\n")
    .map((line, index) => (index === 0 ? line : `  ${line}`))
    .join("\n");
  return raw.replace(marker, `/* @aidlc-shipped-entrypoints@ */ ${rendered}`);
}

// The adapter imports its leaf tools from core/ in this repository; in a
// project they sit in the engine tree beside .opencode/ (both channels ship
// it), never inside .opencode/, which opencode scans for tools.
const PLUGIN_TOOL_IMPORTS = ["aidlc-executable-path.ts"];

function projectedToolImports(raw: string, harnessDir: string): string {
  let out = raw;
  for (const file of PLUGIN_TOOL_IMPORTS) {
    const authored = `"../../../core/tools/${file}"`;
    if (!out.includes(authored)) throw new Error(`opencode adapter no longer imports ${file} from core/tools.`);
    out = out.replaceAll(authored, `"../../${harnessDir}/tools/${file}"`);
  }
  return out;
}

export default function emit(ctx: EmitContext): void {
  const { coreRoot, harnessRoot, distRoot, harnessDir, substituteToken, tierCap } = ctx;
  const SHELL = join(distRoot, ".opencode");
  const ACTIVE_MEMORY = join(distRoot, "aidlc", "spaces", "default", "memory");
  if (!existsSync(ACTIVE_MEMORY)) {
    throw new Error(`opencode emission requires the shipped memory tree at ${ACTIVE_MEMORY}.`);
  }

  const emissions: Array<{ path: string; content: () => string }> = [];

  // Persona subagents from core/agents/*.md (tier-projected, body → .aidlc).
  const agentsDir = join(coreRoot, "agents");
  const agents = ctx.method.agents.toSorted((left, right) => left.slug.localeCompare(right.slug));
  for (const agent of agents) {
    const f = `${agent.slug}.md`;
    const raw = injectDelegatedKnowledgePreflight(
      absorbReviewerKnowledge({ content: readFileSync(join(agentsDir, f), "utf-8"),
        agentName: agent.slug, sourceRoot: coreRoot, reviewerAgents: ctx.reviewerAgents }),
      agent.slug, harnessDir,
    );
    const legacyModelSurface: Parameters<typeof createOpenCodeAgentRenderer>[0] = (request) => {
      if (request.agent.model.kind !== "tier") return refused<ProjectionRefusal>({
        kind: "render-failed", concept: "agent", name: request.agent.slug,
        reason: "This core-agent bridge requires an authored model tier.",
      });
      const effective = resolveModelPolicy(null, modelAgentName(join(agentsDir, f)),
        request.agent.model.tier, "opencode", tierCap);
      return accepted(writeMarkdownAgentSurface(raw.replace(/^\uFEFF/, ""), effective, {
        effortKey: request.effortKey, removeKeys: [...request.removeKeys],
        afterProjectionLines: [...request.afterProjectionLines],
      }));
    };
    const rendering = createOpenCodeAgentRenderer(legacyModelSurface)({
      agent, knowledge: ctx.method.knowledge,
    });
    if (!rendering.ok) throw new Error(JSON.stringify(rendering.refusal));
    for (const nativeAgent of rendering.value) {
      if (nativeAgent.content.kind !== "text") {
        throw new Error(`OpenCode emitted non-text content for ${agent.slug}`);
      }
      const nativeText = nativeAgent.content.text;
      emissions.push({ path: join(distRoot, nativeAgent.path),
        content: () => projectActiveMemoryReferences(substituteToken(nativeText)),
      });
    }
    // The conductor reads this core-projected copy for inline persona framing.
    // It needs the same valid method path as the native subagent twin.
    const inlinePath = join(distRoot, ".aidlc", "agents", f);
    emissions.push({
      path: inlinePath,
      content: () => projectActiveMemoryReferences(readFileSync(inlinePath, "utf-8")),
    });
  }

  // Authored shell surfaces, copied with token substitution on the .md.
  emissions.push({
    path: join(SHELL, "command", "aidlc.md"),
    content: () => substituteToken(readFileSync(join(harnessRoot, "command", "aidlc.md"), "utf-8")),
  });
  emissions.push({
    path: join(SHELL, "plugin", "aidlc-opencode-adapter.ts"),
    content: () =>
      substituteToken(
        projectedToolImports(
          embedShippedEntrypoints(
            readFileSync(join(harnessRoot, "plugin", "aidlc-opencode-adapter.ts"), "utf-8"),
            distRoot,
          ),
          harnessDir,
        ),
      ),
  });

  // Clean-sweep the shell so a removed persona/command cannot linger. In
  // --check mode the packager supplies an isolated distRoot, then compares the
  // complete generated tree with the independently generated counterpart.
  rmSync(SHELL, { recursive: true, force: true });
  for (const { path, content } of emissions) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content(), "utf-8");
  }
  ctx.emitCommands(openCodeCommandPath);
}
