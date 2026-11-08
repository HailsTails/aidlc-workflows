// harness/copilot/emit.ts — the GitHub Copilot per-shell emission plugin.
//
// The unified packager copies core/ → dist/copilot/.aidlc/ and runs graph
// compile there, then calls this emit() for the .github/ shell — the project
// discovery surface BOTH Copilot surfaces read (CLI 1.0.74+ and VS Code agent
// mode 1.130+; verified by the compatibility-spike evidence):
//   - .github/hooks/aidlc.json — the hook wiring: PascalCase event names in
//     the {"version":1} envelope (the shared-recipe: BOTH surfaces then
//     deliver snake_case payloads to the adapter), matcher-FREE (VS Code
//     parses but IGNORES matchers, so every adapter target self-filters).
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

import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { EmitContext } from "../../scripts/manifest-types.ts";
import {
  modelAgentName, resolveModelPolicy, writeMarkdownAgentSurface,
} from "../../core/tools/aidlc-model-policy.ts";
import { absorbReviewerKnowledge,
  injectDelegatedKnowledgePreflight } from "../../scripts/agent-knowledge.ts";
import { EXTENDED_SUBPROCESS_TIMEOUT_MS } from "../../core/tools/aidlc-runtime-budget.ts";
import { accepted, refused } from "../../src/kernel/result.ts";
import type { ProjectionRefusal } from "../../src/projection/domain/projection.ts";
import { copilotAgentRenderer, type CopilotModelSurface,
  type CopilotRuntimeSurface } from "../../src/hosts/copilot/projection/agent-renderer.ts";
import { copilotCommandPath } from "../../src/hosts/copilot/projection/command-renderer.ts";
import { LAUNCHER_PATH, launcherBody } from "../../core/tools/aidlc-launcher-voucher.ts";

// ---------------------------------------------------------------------------
// Hook wiring. PascalCase events; register ONLY events with a real core-hook
// consumer (kiro-normative). One PreToolUse registration serves the guards
// (state-transition, reviewer-scope, review-freeze, plan-approval) - the
// adapter runs them in that order. SessionEnd is omitted because VS Code does
// not document or accept that event. The shared manifest must be valid on
// both hosts, so both use the adapter's next-SessionStart reconciliation path
// for SESSION_ENDED.
// ---------------------------------------------------------------------------
const HOOK_TIMEOUT_SECONDS = EXTENDED_SUBPROCESS_TIMEOUT_MS / 1000;
const COMPOUND_HOOK_TIMEOUT_SECONDS = HOOK_TIMEOUT_SECONDS * 2;
const HOOK_WIRING: Array<{ event: string; target: string; timeoutSec: number }> = [
  { event: "SessionStart", target: "session-start", timeoutSec: HOOK_TIMEOUT_SECONDS },
  { event: "UserPromptSubmit", target: "record-human-turn", timeoutSec: HOOK_TIMEOUT_SECONDS },
  { event: "PreToolUse", target: "guard-tool-call", timeoutSec: HOOK_TIMEOUT_SECONDS },
  { event: "PostToolUse", target: "post-tool", timeoutSec: COMPOUND_HOOK_TIMEOUT_SECONDS },
  { event: "PreCompact", target: "validate-state", timeoutSec: HOOK_TIMEOUT_SECONDS },
  { event: "SubagentStart", target: "subagent-start", timeoutSec: HOOK_TIMEOUT_SECONDS },
  { event: "SubagentStop", target: "log-subagent", timeoutSec: HOOK_TIMEOUT_SECONDS },
  { event: "Stop", target: "continue-workflow", timeoutSec: COMPOUND_HOOK_TIMEOUT_SECONDS },
];

function emitHooksJson(harnessDir: string): string {
  const hooks: Record<string, Array<Record<string, unknown>>> = {};
  for (const { event, target, timeoutSec } of HOOK_WIRING) {
    const cmd = `bun ${harnessDir}/hooks/aidlc-copilot-adapter.ts ${target}`;
    hooks[event] ??= [];
    // `bash` maps to linux+osx on the IDE and runs verbatim on the CLI;
    // `powershell` covers Windows on both (bun is cross-platform).
    hooks[event].push({ type: "command", bash: cmd, powershell: cmd, timeoutSec });
  }
  return `${JSON.stringify({ version: 1, hooks }, null, 2)}\n`;
}

export default function emit(ctx: EmitContext): void {
  const { coreRoot, harnessRoot, distRoot, harnessDir, substituteToken } = ctx;
  const SHELL = join(distRoot, ".github");
  const SKILLS_DST = join(SHELL, "skills");

  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir).sort()) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...walk(full));
      else out.push(full);
    }
    return out;
  }

  const emissions: Array<{ path: string; content: () => string }> = [];

  // The packager rendered AGENTS.md (onboarding) before emit runs; its
  // skeleton names skills under <harnessDir>/skills/, but Copilot discovers
  // skills ONLY at .github/skills/. Rewrite the path family in place (the
  // codex idiom: its prose rewrite maps the same skeleton lines onto
  // .agents/skills/). Anchored on the slash-suffixed form — the one
  // permitted transform class.
  const agentsMdPath = join(distRoot, "AGENTS.md");
  if (existsSync(agentsMdPath)) {
    emissions.push({
      path: agentsMdPath,
      content: () =>
        readFileSync(agentsMdPath, "utf-8").replaceAll(
          `${harnessDir}/skills/`,
          ".github/skills/",
        ),
    });
  }

  // Hook wiring.
  emissions.push({
    path: join(SHELL, "hooks", "aidlc.json"),
    content: () => emitHooksJson(harnessDir),
  });

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
        absorbReviewerKnowledge(authored.value, request.agent.slug, coreRoot),
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

  // (a) authored orchestrator shell — token-substituted from harness/copilot/.
  for (const f of ["SKILL.md", "question-rendering.md", "composer.md", "tables.md"]) {
    emissions.push({
      path: join(SKILLS_DST, "aidlc", f),
      content: () => substituteToken(readFileSync(join(harnessRoot, "skills", "aidlc", f), "utf-8")),
    });
  }
  // (d) session skills — copied from core/ with token substitution (the
  // engine dir ships NO skills/ — Copilot never scans it).
  for (const skill of ["aidlc-session-cost", "aidlc-replay", "aidlc-outcomes-pack", "aidlc-knowledge", "aidlc-issue-report"]) {
    const srcDir = join(coreRoot, "skills", skill);
    if (!existsSync(srcDir)) continue;
    for (const file of walk(srcDir)) {
      const rel = relative(srcDir, file);
      emissions.push({
        path: join(SKILLS_DST, skill, rel),
        content: () => substituteToken(readFileSync(file, "utf-8")),
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
