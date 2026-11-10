// harness/claude/manifest.ts — the Claude Code distribution row.
//
// One core, N harnesses (dist-unified). This manifest tells scripts/package.ts
// how to project the harness-neutral core/ tree into dist/claude/.claude/:
//   - the harness directory token substitution ({{HARNESS_DIR}} → .claude)
//   - the per-dir map (core/<src> → <harnessDir>/<dst>); Claude renames nothing
//   - which authored files live in harness/claude/ and where they land
//
// Claude is a peer harness, not the identity transform: its prose carries the
// same {{HARNESS_DIR}} token as every other harness; the packager substitutes
// `.claude` here.

import { CLAUDE_HOST_DATA } from "../../src/hosts/claude/host-data.ts";
import type { HarnessManifest } from "../../scripts/manifest-types.ts";
import onboardingFills from "./onboarding.fills.ts";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { modelAgentName, resolveModelPolicy,
  writeMarkdownAgentSurface } from "../../core/tools/aidlc-model-policy.ts";
import { absorbReviewerKnowledge,
  injectDelegatedKnowledgePreflight } from "../../scripts/agent-knowledge.ts";
import { accepted, refused } from "../../src/kernel/result.ts";
import type { ProjectionRefusal } from "../../src/projection/domain/projection.ts";
import { createClaudeAgentRenderer,
  type ClaudeAgentLegacy } from "../../src/hosts/claude/projection/agent-renderer.ts";

import { claudeCommandPath } from "../../src/hosts/claude/projection/command-renderer.ts";

const manifest: HarnessManifest = {
  name: "claude",
  productName: CLAUDE_HOST_DATA.productName,
  // AI-DLC's status line. It ships here, not in .claude/settings.json: the
  // team file outranks the person's own status line, so the engine writes this
  // into their .claude/settings.local.json only when they choose it (#1407).
  statusLine: CLAUDE_HOST_DATA.statusLine,
  // SubagentStop runs before a foreground agent's result comes back (it can
  // keep the agent running), and a background dispatch is counted in the
  // in-flight ledger until its SubagentStop. Claude Code sets
  // CLAUDE_CODE_SESSION_ID in its agent's shell.
  agentFinishRecorded: CLAUDE_HOST_DATA.agentFinishRecorded,
  // AskUserQuestion takes four options besides its own "Type something" row
  // (question-rendering.md, "Batching limits"), so a question is lettered A-D.
  questionOptions: 4,
  // A Claude Code session open before setup has no /aidlc and runs none of
  // its hooks until it starts again.
  configNextStep:
    CLAUDE_HOST_DATA.configNextStep,
  // Its Bash PreToolUse hooks beat in the record before each engine command,
  // and reviewer-scope beats before its own off switch. Measured live: a
  // project's .claude/settings.local.json outranks the project and user files,
  // so one `"disableAllHooks": false` there covers a switch-off in any of them
  // without touching the person's user settings, and it takes effect in the
  // same chat (no restart; /hooks is not the step).
  hookActivation: CLAUDE_HOST_DATA.hookActivation,
  // Claude Code marks every command its agent runs (measured in its Bash tool,
  // 2.1.318); a native engine with several tools set up reads this to know it
  // runs for Claude Code.
  hostShell: CLAUDE_HOST_DATA.hostShell,
  // A clean chat for new work started beside other work: /clear starts a new
  // conversation and keeps the old one for /resume.
  newChatStep: CLAUDE_HOST_DATA.newChatStep,
  harnessDir: ".claude",
  orchestratorSkillPath: ".claude/skills/aidlc/SKILL.md",
  tierFlavor: "claude",
  rootIntegrations: [
    {
      path: ".gitignore",
      policy: "managed-block",
      marker: "gitignore",
      shared: "union",
      legacySignatures: {
        wholeFileHashes: [
          "sha256:3da36b2d01551aeae2e366caa08be8cce0dbc9110e252445dcaa4e758e24a0b6",
          "sha256:4f1cd2e930bd37d2f5d715a06ea3fa1e2d39479fc662f0f0562116376132114b",
          "sha256:f2affb8b34499f057284852456cb8a24ae586b8e816595bf98346141f3516281",
          // The pre-v2-sync shipped variant.
          "sha256:d397e69ac701a663158ccb43fda3f0a23c86365f29419a8c9a5e3287a490370d",
          // Keep pre-engine-directory unmarked root files recognizable.
          "sha256:87e4c1237816c477096f2291f1204885692bf39e487afb3d9f67cf7e9b2c84fb",
          // The variant shipped before the block listed aidlc.settings.local.json.
          "sha256:1d51ae4ca4f74f842336dce75bc66bb4bbf55ce2de7c802ab059504cca99fd7b",
          // The variant shipped with a generic template above the AI-DLC lines.
          "sha256:631688bc85683ea22c9415cb345c69169cff4ac45ec006c258217cd261a7793f",
          // The variant shipped with notes above each group of lines.
          "sha256:051866aa49f8ed915ab5ae30707422068df814ca5be806a1fe28784c543a4aab",
          // The variant shipped before the block ignored aidlc/active-memory/ (the
          // engine's copy of the active space's method).
          "sha256:a618a3a615ef7159c7eed634a5a332bf9d017f8e28d6b0f0adad9db1d2d725e0",
          // The variant shipped before the block ignored aidlc/.aidlc-request-text/
          // (a request the engine has not read yet).
          "sha256:3cc1cbd212d2ca0dbf1e525eb9a40d4694a585eb7864d8b877f8fe8bd99122dc",
        ],
      },
    },
    {
      path: ".mcp.json",
      policy: "json-map",
      jsonKey: "mcpServers",
      optional: true,
      legacySignatures: {
        jsonEntryHashes: {
          context7: [
            "sha256:8a440d21705f35c8f5649f118d17f786e08d589fb2dd888f5de5aa503233afbf",
          ],
          "aws-mcp": [
            "sha256:d6ff496cb02a8b61d81f8534b179f60e42173ee8510eebe3428bf0bfe30ff0aa",
          ],
          "aws-pricing": [
            "sha256:43bc3467687da178f795ad41ad8767da8b255780f95b64d5c7464b2fbff9ef40",
          ],
          "aws-iac": [
            "sha256:9fea0efb8aea62ec3446cc8201bc74cae477c75d36659b47e93d53981cb94686",
          ],
          "aws-serverless": [
            "sha256:858610c8f5ccbbecc39595fdf866f68d0fb32d62750b3d50ee4bdef7ec1d104b",
          ],
        },
      },
    },
  ],

  // core/<src> → <harnessDir>/<dst>. Claude keeps every core dir name as-is.
  // The method ("memory") is not a core dir projected into the harness tree; it
  // lives at the workspace-root aidlc/spaces/default/memory/ (one hand-editable
  // copy, emitted by the packager's memory step), read by Claude through
  // aidlc/active-memory/ via the .claude/rules/aidlc.md @-stub (a harnessFile).
  coreDirs: [
    { src: "tools", dst: "tools" },
    { src: "sensors", dst: "sensors" },
    { src: "scopes", dst: "scopes" },
    { src: "hooks", dst: "hooks" },
  ],

  // Authored harness surfaces copied verbatim (with token substitution on .md)
  // from harness/claude/<src> → <harnessDir>/<dst>.
  harnessFiles: [],

  // Claude keeps neutral guidance and native setup together in its always-on file.
  onboarding: { dst: "CLAUDE.md", fills: onboardingFills },

  rulesRename: CLAUDE_HOST_DATA.rulesFolder,

  runnerFrontmatterAdditions: CLAUDE_HOST_DATA.runnerFrontmatterAdditions,

  skipRunnerGen: true,

  emit(ctx): void {
    ctx.emitCommands(claudeCommandPath);
    for (const agent of ctx.method.agents) {
      const legacyModelSurface: ClaudeAgentLegacy = (request) => {
        if (request.agent.model.kind !== "tier") return refused<ProjectionRefusal>({
          kind: "render-failed", concept: "agent", name: request.agent.slug,
          reason: "This core-agent bridge requires an authored model tier.",
        });
        const captured = ctx.sources.find((source) => source.path === request.agent.source
          && source.owner.kind === request.agent.owner.kind
          && (source.owner.kind === "core" || (request.agent.owner.kind === "plugin"
            && source.owner.plugin === request.agent.owner.plugin)));
        if (!captured) return refused<ProjectionRefusal>({
          kind: "render-failed", concept: "agent", name: request.agent.slug,
          reason: "The accepted agent's authored source was not captured.",
        });
        const original = captured.content.kind === "text" ? captured.content.text
          : Buffer.from(captured.content.bytes).toString("utf-8");
        const prepared = ctx.substituteToken(injectDelegatedKnowledgePreflight(
          absorbReviewerKnowledge({ content: original, agentName: request.agent.slug,
            sourceRoot: ctx.coreRoot, reviewerAgents: ctx.reviewerAgents }),
          request.agent.slug, ctx.harnessDir,
        ));
        const effective = resolveModelPolicy(null, modelAgentName(request.agent.slug),
          request.agent.model.tier, "claude", ctx.tierCap);
        return accepted(writeMarkdownAgentSurface(prepared, effective, {
          effortKey: request.effortKey,
        }));
      };
      const rendering = createClaudeAgentRenderer(legacyModelSurface)({
        agent, knowledge: ctx.method.knowledge,
      });
      if (!rendering.ok) throw new Error(JSON.stringify(rendering.refusal));
      for (const file of rendering.value) {
        const destination = join(ctx.distRoot, file.path);
        mkdirSync(dirname(destination), { recursive: true });
        writeFileSync(destination,
          file.content.kind === "text" ? file.content.text : file.content.bytes);
      }
    }
  },
};

export default manifest;
