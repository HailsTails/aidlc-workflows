// harness/copilot/emit.ts — the GitHub Copilot per-shell emission plugin.
//
// The unified packager copies core/ → dist/copilot/.aidlc/ and runs graph
// compile there, then calls this emit() for the .github/ shell — the project
// discovery surface BOTH Copilot surfaces read (CLI 1.0.74+ and VS Code agent
// mode 1.130+; verified by the compatibility-spike evidence):
//   - .github/agents/aidlc-*-agent.md — the 14 personas as native Copilot
//     custom agents: NO model key (tierFlavor copilot is model-omitted by
//     type — the two surfaces disagree on model: value syntax), and the core
//     Task denial projected to a supported `tools:` allowlist that omits
//     Copilot's `agent` delegation tool. Copilot has no all-except-agent form,
//     so worker agents intentionally do not inherit arbitrary MCP tools.
// MERGE NOTE: in the dist tree .github/ is wholly AIDLC-owned (clean-swept
// each build for --check parity). A USER'S project .github/ is shared with
// real repo content — the install step merges these aidlc-named files in;
// it never replaces the directory. All emissions are aidlc-prefixed so the
// merge is collision-free.

import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { EmitContext } from "../../scripts/manifest-types.ts";
import {
  modelAgentName, resolveModelPolicy, writeMarkdownAgentSurface,
} from "../../core/tools/aidlc-model-policy.ts";
import { absorbReviewerKnowledge,
  injectDelegatedKnowledgePreflight } from "../../scripts/agent-knowledge.ts";
import { accepted, refused } from "../../src/kernel/result.ts";
import type { ProjectionRefusal } from "../../src/projection/domain/projection.ts";
import { copilotAgentRenderer, type CopilotModelSurface,
  type CopilotRuntimeSurface } from "../../src/hosts/copilot/projection/agent-renderer.ts";
import { copilotCommandPath } from "../../src/hosts/copilot/projection/command-renderer.ts";
import { LAUNCHER_PATH, launcherBody } from "../../core/tools/aidlc-launcher-voucher.ts";

function emit(ctx: EmitContext): void {
  const { coreRoot, distRoot, harnessDir, substituteToken } = ctx;
  const SHELL = join(distRoot, ".github");
  const emissions: Array<{ path: string; content: () => string }> = [];

  for (const agent of ctx.method.agents) {
    const captured = ctx.sources.find((source) => source.path === agent.source
      && source.owner.kind === agent.owner.kind
      && (source.owner.kind === "core" || (agent.owner.kind === "plugin"
        && source.owner.plugin === agent.owner.plugin)));
    const authored = captured
      ? accepted(captured.content.kind === "text" ? captured.content.text
        : Buffer.from(captured.content.bytes).toString("utf-8"))
      : refused<ProjectionRefusal>({
        kind: "render-failed", concept: "agent", name: agent.slug,
        reason: "The accepted agent's authored source was not captured.",
      });
    const modelSurface: CopilotModelSurface = (request) => {
      if (!authored.ok) return authored;
      const prepared = injectDelegatedKnowledgePreflight(authored.value,
        request.agent.slug, harnessDir);
      return accepted(substituteToken(writeMarkdownAgentSurface(prepared, {}, {
        removeKeys: [...request.removeKeys],
        afterProjectionLines: [...request.afterProjectionLines],
      })));
    };
    const runtimeSurface: CopilotRuntimeSurface = (request) => {
      if (!authored.ok) return authored;
      if (request.agent.model.kind !== "tier") return refused<ProjectionRefusal>({
        kind: "render-failed", concept: "agent", name: request.agent.slug,
        reason: "This core-agent bridge requires an authored model tier.",
      });
      const prepared = substituteToken(injectDelegatedKnowledgePreflight(
        absorbReviewerKnowledge({ content: authored.value, agentName: request.agent.slug,
          sourceRoot: coreRoot, reviewerAgents: ctx.reviewerAgents }),
        request.agent.slug, harnessDir,
      ));
      const effective = resolveModelPolicy(null, modelAgentName(request.agent.slug),
        request.agent.model.tier, "copilot", ctx.tierCap);
      return accepted(writeMarkdownAgentSurface(prepared, effective, { effortKey: "effort" }));
    };
    const rendering = copilotAgentRenderer(modelSurface, runtimeSurface)({
      agent, knowledge: ctx.method.knowledge,
    });
    if (!rendering.ok) throw new Error(JSON.stringify(rendering.refusal));
    for (const file of rendering.value) {
      emissions.push({
        path: join(distRoot, file.path),
        content: () => file.content.kind === "text" ? file.content.text
          : Buffer.from(file.content.bytes).toString("utf-8"),
      });
    }
  }

  // Clean-sweep the shell so a removed persona/runner cannot linger. In
  // --check mode the packager supplies an isolated distRoot, then compares
  // the complete generated tree with the independently generated counterpart.
  rmSync(SHELL, { recursive: true, force: true });
  for (const { path, content } of emissions) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content(), "utf-8");
  }
  // AI-DLC's engine launcher, the command name the skill's rule allows. The
  // native pass writes `aidlc` for the token.
  const launcher = join(distRoot, LAUNCHER_PATH.replace(/^\.aidlc\//, `${harnessDir}/`));
  mkdirSync(dirname(launcher), { recursive: true });
  writeFileSync(launcher, substituteToken(launcherBody("{{INVOKE}}")), { encoding: "utf-8", mode: 0o755 });
  chmodSync(launcher, 0o755);
  ctx.emitCommands(copilotCommandPath);
}

export default emit;
