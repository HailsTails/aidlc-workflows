// harness/kiro/manifest.ts — the Kiro CLI distribution row.
//
// Projects the harness-neutral core/ tree into dist/kiro/.kiro/, plus Kiro's
// authored shell surfaces (orchestrator skill, agent JSON configs, the stdin
// adapter hook, settings/cli.json, AGENTS.md). Mirrors the proven
// package-kiro.ts spike, generalized onto the unified packager.
//
// Kiro specifics vs Claude:
//   - token → .kiro
//   - rules/ → steering/ (Kiro auto-loads steering; rules ARE the always-on
//     layer)
//   - the orchestrator skill is per-harness (authored here, NOT core), so it
//     is NOT in coreDirs — only the 3 session skills are.
//   - agents/ is MIXED: the persona .md files are core (copied + rules rename
//     n/a); Kiro-native agent JSON is rendered from the captured authored inputs.
//   - hooks/ is MIXED: core hook bodies are copied; the one authored
//     aidlc-kiro-adapter.ts stdin shim is a harnessFile.
//   - AGENTS.md lands at the PROJECT ROOT (dist/kiro/AGENTS.md), outside .kiro/.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { EmitContext, HarnessManifest } from "../../scripts/manifest-types.ts";
import {
  absorbReviewerKnowledge, injectDelegatedKnowledgePreflight,
} from "../../scripts/agent-knowledge.ts";
import {
  modelAgentName, resolveModelPolicy, writeMarkdownAgentSurface,
} from "../../core/tools/aidlc-model-policy.ts";
import { accepted, refused } from "../../src/kernel/result.ts";
import {
  kiroCliAgentRenderer, type KiroModelSurface,
} from "../../src/hosts/kiro/projection/agent-renderer.ts";
import { kiroCommandPath } from "../../src/hosts/kiro/projection/command-renderer.ts";
import { KIRO_HOOK_COMMAND_SUFFIX } from "../../src/hosts/kiro/projection/json-agent-renderer.ts";
import onboardingFills from "./onboarding.fills.ts";
import { KIRO_HOST_DATA } from "../../src/hosts/kiro/host-data.ts";

const modelSurface = (ctx: EmitContext): KiroModelSurface => ({ agent, removeKeys }) => {
  if (agent.model.kind !== "tier") return refused({
    kind: "render-failed", concept: "agent", name: agent.slug,
    reason: "This core-agent bridge requires an authored model tier.",
  });
  const source = ctx.sources.find((file) => file.path === agent.source &&
    file.owner.kind === agent.owner.kind && (file.owner.kind === "core" ||
      (agent.owner.kind === "plugin" && file.owner.plugin === agent.owner.plugin)));
  if (source === undefined) return refused({
    kind: "render-failed", concept: "agent", name: agent.slug,
    reason: "This core-agent bridge requires captured agent text.",
  });
  const authored = source.content.kind === "text" ? source.content.text :
    Buffer.from(source.content.bytes).toString("utf-8");
  const raw = injectDelegatedKnowledgePreflight(
    absorbReviewerKnowledge({ content: authored, agentName: agent.slug,
      sourceRoot: ctx.coreRoot, reviewerAgents: ctx.reviewerAgents }),
    agent.slug, ctx.harnessDir,
  );
  const text = ctx.substituteToken(raw).replace(/\.kiro\/rules\/(?!default\.rules)/g, ".kiro/steering/");
  const effective = resolveModelPolicy(
    null, modelAgentName(agent.slug), agent.model.tier, "kiro", ctx.tierCap,
  );
  return accepted(writeMarkdownAgentSurface(text, effective, {
    effortKey: "effort", removeKeys: [...removeKeys],
  }));
};

const emitAgents = (ctx: EmitContext): void => {
  const renderAgent = kiroCliAgentRenderer(modelSurface(ctx));
  for (const agent of ctx.method.agents) {
    const rendering = renderAgent({ agent, knowledge: ctx.method.knowledge });
    if (!rendering.ok) throw new Error(JSON.stringify(rendering.refusal));
    for (const file of rendering.value) {
      if (file.content.kind !== "text") {
        throw new Error(`Kiro emitted non-text content for ${agent.slug}`);
      }
      const destination = join(ctx.distRoot, file.path);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, file.content.text);
    }
  }
};

const manifest: HarnessManifest = {
  name: "kiro",
  productName: KIRO_HOST_DATA.productName,
  // This tree's agents are built for Kiro CLI's v2 engine; the kiro-ide tree,
  // listed as Kiro, is the one for Kiro IDE and Kiro CLI on v3.
  choiceName: "Kiro CLI (V2)",
  configNextStep: KIRO_HOST_DATA.configNextStep,
  // This tree registers its hooks in the agent JSON `hooks` block, which Kiro
  // CLI's v2 engine runs while the aidlc agent is active. The v3 engine (KAS)
  // does not run that file as shipped: measured on kiro-cli 2.21.1 over ACP for
  // #1487, v2 7 heartbeats and a HUMAN_TURN, `--agent-engine v3` none. Kiro's
  // own upgrade rewrites the agent JSON into a universal format whose hooks v3
  // runs and v2 still runs (measured on kiro-cli 2.23.1), keeping each original
  // as `<name>.json.bak`. From Kiro CLI 2.37 a v3 start makes that upgrade by
  // itself unless `chat.enableAutoAgentUpgrade` is false in the person's own
  // Kiro settings: on kiro-cli 3.1.0 `kiro-cli --v3` rewrote all 15 agent files
  // before "Trust this workspace?" was answered, and the hooks then ran on v3.
  // With the setting false the files stay, Kiro shows `agent "aidlc" needs
  // upgrading for this agent engine, using "default"` at launch, and
  // `/upgrade-agent` upgrades them for the next start (the same chat stays on
  // Kiro's default agent). `kiro-cli acp --agent-engine v3` upgraded nothing
  // and started on Kiro's default agent. The advice names v2 rather than "the
  // default": a user setting (`chat.agentEngine`) or a later Kiro release can
  // make v3 the default, and `kiro-cli --help` already calls v2 "the pre-3.0
  // default".
  // `--v2` exists from Kiro CLI 2.21.4. A plain `kiro-cli` follows the person's
  // own engine setting, which may choose v3, so the start lines name the
  // engine; the spellings for older releases are in the Kiro CLI guide's
  // Prerequisites, so each line stays one command.
  // Measured live: with another agent picked, `/agent` and aidlc bring the
  // hooks back in the same chat. On v3 with the files not upgraded `/agent`
  // cannot: aidlc is not in its list (kiro-cli 3.1.0), and Kiro's own
  // needs-upgrading line shows only on its launch screen, which the agent does
  // not see (it showed the `/agent` line there). So every line gives the person
  // both steps, keyed to what they see in that list, and the ways back from v3:
  // Kiro's upgrade and a start on v3, the switch to Kiro (the tree made for
  // v3), or a start on v2. The packager fills `{{INVOKE}}` with the install's
  // own command. Its execute_bash hooks (review-freeze, plan-approval-guard)
  // beat in the record before each engine command, ahead of their own off
  // switches.
  // The prompt adapter runs the human-turn hook on every message, which leaves
  // a heartbeat before the first workflow too.
  hookActivation: KIRO_HOST_DATA.hookActivation,
  // Kiro CLI names the chat in every command its agent runs (KIRO_SESSION_ID).
  hostShell: KIRO_HOST_DATA.hostShell,
  // A clean chat for new work started beside other work: Kiro CLI's own
  // command, which keeps the old chat for /chat resume (the Kiro CLI guide).
  newChatStep: KIRO_HOST_DATA.newChatStep,
  harnessDir: ".kiro",
  orchestratorSkillPath: ".kiro/skills/aidlc/SKILL.md",
  tierFlavor: "kiro",
  kiroLayout: KIRO_HOST_DATA.kiroLayout,
  // Kiro CLI starts a hook as `"powershell" -Command "<command>"` on Windows and
  // `/bin/bash -c "<command>"` on Linux (measured on kiro-cli 2.34.0), and it
  // stops a tool call only on exit 2. Windows PowerShell's -Command hands back
  // 1 for every native exit code but 0 and 1, so without this no refusal
  // stopped anything there. `exit $LASTEXITCODE` is PowerShell's own way to
  // keep the code; in bash the unset variable leaves a plain `exit`, which
  // keeps the last command's status. tests/unit/t-kiro-hook-exit-code.test.ts
  // runs a refusal both ways.
  hookCommandSuffix: KIRO_HOOK_COMMAND_SUFFIX,
  rootIntegrations: [
    {
      path: ".gitignore",
      policy: "managed-block",
      marker: "gitignore",
      shared: "union",
      legacySignatures: {
        wholeFileHashes: [
          "sha256:83449fdda4644b319cbea5dcbde11919722b5dd6761f4edb4caf0e0e53dc9c6b",
          // Keep pre-engine-directory unmarked root files recognizable.
          "sha256:469dbf89f83865b58b2ae4c51dd2f2fe51fd80a9e2033bfb233688141d0cf632",
          // The variant shipped before the block listed aidlc.settings.local.json.
          "sha256:af1b98a4b8c0e288aa8177655495b4a65220dbed2e149a67780aff1e8f379c9d",
          // The variant shipped with a generic template above the AI-DLC lines.
          "sha256:2f413414992c405c11a8bccb230574c2f58cec8fd2906cd37b7cd62bb33a97d8",
          // The variant shipped with notes above each group of lines.
          "sha256:f08d78b3e456c3a7cd7c998196c9bf6d59d24900e2ccf78cf30a1b189e766c2c",
          // The variant shipped before the block ignored aidlc/active-memory/ (the
          // engine's copy of the active space's method).
          "sha256:28a69800dcac189aa2a976820db237b45bcf6dd7d7e6d4fae5c1603225b9957a",
          // The variant shipped before the block ignored aidlc/.aidlc-request-text/
          // (a request the engine has not read yet).
          "sha256:99b4560aa1bd95f26077eb69a0c6c2a40f81146a212e70d876c27bb84f2b1789",
        ],
      },
    },
    {
      path: "AGENTS.md",
      policy: "managed-block",
      marker: "agents",
      shared: "identical",
      legacySignatures: {
        wholeFileHashes: [
          "sha256:4f7133cc1a9bb1243245c25c28fad57c3660b35e251ea36cea3aa2db431bf55f",
          "sha256:992307cc3fac05d81958851b2ca51db3723fea604c8d2636814ef9b2e9f7a848",
          "sha256:b886d5b375f9ebc33ef206c4f6ad20630a13eb83d0f5838e9f71f483c040f362",
          "sha256:c6796d512752c8f4aa927c9de3fb794e3432f62dd85b77fe3da1101d90aa5a0b",
          "sha256:cd7c66ba1bdd67af0be6203a1d8928efc01733ef196201003e914051d1309a28",
          "sha256:e01ac1caf52a59d25faf859a03cfb65b803853c99298bbcbc80ef565e7628de6",
          "sha256:e3de4a295f9b9404b40678c28c0773ae432ac8d4aeacc07613ecfcdfbb4c866b",
          "sha256:e85a5d7ce13b676282dc99572f89c81256f2dada50b1881f4c9641e61339f5a4",
          // The pre-v2-sync shipped variant (2.6.123 merge changed the bytes).
          "sha256:67a57eddd94d613590d34ec2d0181398123d9e2d9f6382eb36c62233ce02b6f9",
          // Keep pre-engine-directory unmarked root files recognizable.
          "sha256:3aea80a2afde8bb2a222b329bcfc2855b4207a53f7fbfbc3abbfb4aadbafc53b",
          "sha256:1abeb3cb19943bc1537c413dc45298c43a14ce7544444c88c13b53ea48a607a6",
          "sha256:ecb68f08789258e77c81488e98dd1632b607b567a2424311c4dcdc30ce3e768f",
          // The 2.9.0 shipped variant (#1131 changed the onboarding record-dir shape).
          "sha256:9ad7daa07cbafe9f149311b679281eecd991d2ec77787fc7751226ea0622522b",
          // The pre-neutral shipped variant (#1268 made the root block harness-neutral).
          "sha256:c8777a03505f11dcbb4fb339fef1a8072d9d2500ce401b69a06073b523ea2c67",
          // The variant shipped before the onboarding waited for the person to invoke AI-DLC.
          "sha256:6de1298dfa4c2b6916f66d372b844faf23481c8f258eedd595c1423dab8e106d",
        ],
      },
    },
  ],

  // Same core projection as claude, EXCEPT: rules→steering, and the
  // orchestrator skill (skills/aidlc/) is authored, not core.
  coreDirs: [
    { src: "tools", dst: "tools" },
    { src: "aidlc-common", dst: "aidlc-common" },
    { src: "knowledge", dst: "knowledge" },
    { src: "sensors", dst: "sensors" },
    { src: "scopes", dst: "scopes" },
    { src: "agents", dst: "agents" },
    { src: "hooks", dst: "hooks" },
  ],

  // Authored Kiro shell surfaces. These carry literal `.kiro` (harness-specific
  // by construction); they are .md/.json/.ts copied verbatim (the .md token
  // substitution is a no-op on them — no {{HARNESS_DIR}} token present).
  harnessFiles: [
    { src: "hooks/aidlc-record-human-turn.kiro.hook", dst: "hooks/aidlc-record-human-turn.kiro.hook" },
    { src: "hooks/aidlc-plan-approval-guard.kiro.hook", dst: "hooks/aidlc-plan-approval-guard.kiro.hook" },
    { src: "settings/cli.json", dst: "settings/cli.json" },
  ],

  pluginAgentFrontmatter: KIRO_HOST_DATA.pluginAgentFrontmatter.copy,

  // Neutral root guidance is shared; native setup is loaded through agent resources.
  onboarding: { dst: "AGENTS.md", projectRoot: true, harnessDst: "steering/aidlc-onboarding.md", fills: onboardingFills },

  // rules/ → steering/ (applied after the token substitution, anchored).
  rulesRename: KIRO_HOST_DATA.rulesFolder,

  skipRunnerGen: true,

  emit(ctx): void {
    emitAgents(ctx);
    ctx.emitCommands(kiroCommandPath);
  },

  // Kiro has no host plugin store — AIDLC plugins arrive by folder-drop and use
  // the explicit composer. Kiro CLI's v2 engine reads hooks only from the
  // agent configs. Its v3 engine (KAS) does not run the agent configs as
  // shipped, nor the two `.kiro.hook` files projected above (measured on
  // kiro-cli 2.21.1; see #1487); it runs the agent configs' hooks once Kiro has
  // upgraded them (hookActivation's comment). Kiro CLI v3 is served by the
  // kiro-ide distribution.
  plugin: { manifestDir: ".kiro-plugin", kind: "kiro" },
};

export default manifest;
