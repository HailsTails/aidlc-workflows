import { KIRO_IDE_HOST_DATA, KIRO_IDE_AGENT_SHELL, KIRO_IDE_OPEN_REST, KIRO_CLI_START, KIRO_CLI_START_REST } from "../../src/hosts/kiro-ide/host-data.ts";
// harness/kiro-ide/manifest.ts — the Kiro distribution row for Kiro's unified
// agent harness, which Kiro IDE 1.x and Kiro CLI v3 both run and both read
// from the same .kiro/ tree.
//
//   - Agents ship as Markdown only. The conductor is an authored aidlc-aidlc.md;
//     persona files come from core and receive native tools/permissions.
//   - settings/cli.json asks Kiro CLI for the v3 engine and the aidlc agent.
//     The v2 engine runs no .kiro/hooks at all, and a hook cannot detect that
//     from inside. Kiro CLI 2.33.0 reads the engine only from the person's own
//     settings or the command line (measured: a project value is ignored, and
//     `kiro-cli settings --workspace chat.agentEngine` is refused), so every
//     line here that tells a person to start Kiro CLI's chat says
//     `kiro-cli --v3`; older Kiro CLI releases still read the pin. Kiro IDE
//     does not read this file.
//   - Always-included steering carries the active-space memory text, written
//     by the engine (core/tools/aidlc-includes.ts kiroIdeSteering) and
//     gitignored; the shipped file is its reference form.
//   - Hooks ship as v1 .kiro/hooks/*.json only; both surfaces register them at
//     session start. IDE 0.x .kiro.hook files are not shipped: IDE 1.x never
//     executes them.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  absorbReviewerKnowledge, injectDelegatedKnowledgePreflight,
} from "../../scripts/agent-knowledge.ts";
import {
  modelAgentName, resolveModelPolicy, writeMarkdownAgentSurface,
} from "../../core/tools/aidlc-model-policy.ts";
import { accepted, refused } from "../../src/kernel/result.ts";
import {
  kiroAgentRenderer, type KiroModelSurface,
} from "../../src/hosts/kiro/projection/agent-renderer.ts";
import {
  kiroIdePermissionLines,
} from "../../src/hosts/kiro-ide/projection/agent-renderer.ts";
import { inlineAgentSet } from "../../src/workflow-definition/domain/method-participation.ts";
import type { EmitContext, HarnessManifest } from "../../scripts/manifest-types.ts";
import { kiroIdeCommandPath } from "../../src/hosts/kiro-ide/projection/command-renderer.ts";
import {
  copyChannelDelegateShellDeny,
  nativeDelegateShellDeny,
  RISKY_SHELL_FORMS,
  riskyFormDenyLines,
  shellDenyLines,
} from "./delegate-shell-deny.ts";
import onboardingFills from "./onboarding.fills.ts";

const DELEGATION_AGENTS = [
  "aidlc-composer-agent",
  "aidlc-developer-agent",
  "aidlc-architect-agent",
  "aidlc-product-lead-agent",
  "aidlc-architecture-reviewer-agent",
  "aidlc-product-agent",
  "aidlc-design-agent",
  "aidlc-delivery-agent",
  "aidlc-aws-platform-agent",
  "aidlc-compliance-agent",
  "aidlc-devsecops-agent",
  "aidlc-quality-agent",
  "aidlc-pipeline-deploy-agent",
  "aidlc-operations-agent",
] as const;

const PLUGIN_AGENT = "plugin-agent";
const copyShellDeny = new Map<string, string[]>(
  [...DELEGATION_AGENTS, PLUGIN_AGENT].map((agent) => [agent, [
    ...shellDenyLines(copyChannelDelegateShellDeny(".kiro", agent)),
    ...riskyFormDenyLines(["bun .kiro/tools/aidlc"]),
  ]]),
);
const permissionPolicy = {
  shellDeny: (agent: string): readonly string[] => copyShellDeny.get(agent) ?? [],
  riskyForms: RISKY_SHELL_FORMS,
};

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
  const substituted = ctx.substituteToken(raw);
  const text = substituted.replace(/\.kiro\/rules\/(?!default\.rules)/g, ".kiro/steering/");
  const effective = resolveModelPolicy(
    null, modelAgentName(agent.slug), agent.model.tier, "kiro", ctx.tierCap,
  );
  return accepted(writeMarkdownAgentSurface(text, effective, {
    effortKey: "effort", removeKeys: [...removeKeys],
  }));
};

const emitAgents = (ctx: EmitContext): void => {
  const inlineAgents = inlineAgentSet(ctx.method);
  const renderAgent = kiroAgentRenderer({
    modelSurface: modelSurface(ctx),
    promptLines: (agent) => kiroIdePermissionLines(permissionPolicy)(agent.slug),
    inlineReading: (agent) => inlineAgents.has(agent.slug)
      ? "reads-inline" : "dispatched-only",
  });
  for (const agent of ctx.method.agents) {
    const rendering = renderAgent({ agent, knowledge: ctx.method.knowledge });
    if (!rendering.ok) throw new Error(JSON.stringify(rendering.refusal));
    for (const file of rendering.value) {
      if (file.content.kind !== "text") {
        throw new Error(`Kiro IDE emitted non-text content for ${agent.slug}`);
      }
      const destination = join(ctx.distRoot, file.path);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, file.content.text);
    }
  }
};

const manifest: HarnessManifest = {
  name: "kiro-ide",
  // One tree for Kiro IDE and Kiro CLI, so it is named after neither.
  productName: KIRO_IDE_HOST_DATA.productName,
  choiceNote: "Kiro IDE and Kiro CLI on its v3 engine",
  configNextStep: KIRO_IDE_HOST_DATA.configNextStep,
  // Kiro IDE runs a folder's hooks and loads its aidlc agent only after the
  // folder is trusted and the window reloads; until then the first approval
  // gate cannot see the human's reply, so those steps come before the first
  // prompt. An untrusted folder opens in Restricted Mode: its banner offers
  // Manage, which opens the Workspace Trust page with the Trust button. Trust
  // lets the folder's hooks run commands, so it is offered for a known folder.
  firstRunSteps: [
    "1. Open this folder in Kiro IDE. If the Restricted Mode banner shows at the",
    "   top of the window and you know what is in this folder, select Manage on",
    "   it, then Trust.",
    '2. Run "Developer: Reload Window" from the Command Palette',
    "   (Ctrl+Shift+P, or Cmd+Shift+P on macOS) so Kiro loads the AIDLC hooks",
    "   and the aidlc agent.",
    "3. Choose the aidlc agent in the chat panel's agent picker.",
    '4. /aidlc "what you want built"  describe your first intent',
    "",
    "Using Kiro CLI instead? Start `kiro-cli --v3` in this folder. If Kiro asks",
    "whether you trust this workspace and you know what is in this folder,",
    'choose "Trust, continue". Then step 4.',
  ],
  // The same lines with Kiro CLI first, where a supported kiro-cli is on an
  // absolute PATH entry and setup runs outside Kiro IDE
  // (core/tools/aidlc-config-diagnostics.ts harnessCliLeads): someone who has
  // only Kiro CLI reads its step first, and Kiro IDE's after it. Doctor's copy
  // is hookActivation.notRunYetCliFirst.
  cliFirst: {
    env: KIRO_IDE_AGENT_SHELL,
    configNextStep: `${KIRO_CLI_START}${KIRO_CLI_START_REST} (in Kiro IDE, open this project instead${KIRO_IDE_OPEN_REST})`,
    firstRunSteps: [
      "1. Start `kiro-cli --v3` in this folder. If Kiro asks whether you trust",
      "   this workspace and you know what is in this folder, choose",
      '   "Trust, continue".',
      '2. /aidlc "what you want built"  describe your first intent',
      "",
      "Using Kiro IDE instead? Open this folder in Kiro IDE. If the Restricted",
      "Mode banner shows at the top of the window and you know what is in this",
      'folder, select Manage on it, then Trust. Run "Developer: Reload Window"',
      "from the Command Palette (Ctrl+Shift+P, or Cmd+Shift+P on macOS), choose",
      "the aidlc agent in the chat panel's agent picker, then step 2.",
    ],
  },
  // Kiro IDE has no CLI of its own to probe. Its integrated terminal sets
  // TERM_PROGRAM=kiro (captured from Kiro IDE 1.1.14 on Windows), and its git
  // askpass helper (VSCODE_GIT_ASKPASS_NODE) is the Kiro executable. A miss
  // only loses the default choice. KIRO_* variables are not a signal: that
  // terminal sets none, and Kiro CLI users set them in any shell.
  editorTerminalApp: "kiro",
  // Measured live: the only cause seen of Kiro IDE running no hooks is a
  // folder it has not been allowed to run commands in. Then every agent
  // command comes back with no output and exit code -1, so no AI-DLC message
  // can run; the agent's step sits in what it reads first (its orchestrator
  // skill). Trust takes effect only after a window reload: a trusted folder ran
  // no hook until Developer: Reload Window (measured 2026-10-05 on Kiro IDE
  // 1.1.14 from the Restricted Mode banner, and on 1.2.4 from both the banner
  // and Trust Folder & Continue), so every copy of the step names both.
  // Another agent in the picker did not stop the hooks. What an ACP client
  // must send to run hooks is in the Kiro IDE guide.
  hookActivation: KIRO_IDE_HOST_DATA.hookActivation,
  // Kiro CLI v3 and Kiro IDE name the chat in the commands their agent runs
  // (KIRO_SESSION_ID; measured on Kiro IDE 1.2.37, #2167). Not TERM_PROGRAM=kiro:
  // Kiro IDE's own terminal sets it too, so a tool started there would read as Kiro.
  hostShell: KIRO_IDE_HOST_DATA.hostShell,
  // A clean chat for new work started beside other work. Kiro CLI has its own
  // command and opens on the aidlc agent; Kiro IDE opens a new chat on its
  // Default agent, so its step picks aidlc, told apart as the hook lines are.
  newChatStep: KIRO_IDE_HOST_DATA.newChatStep,
  harnessDir: ".kiro",
  orchestratorSkillPath: ".kiro/skills/aidlc/SKILL.md",
  tierFlavor: "kiro",
  kiroLayout: KIRO_IDE_HOST_DATA.kiroLayout,
  rootIntegrations: [
    {
      path: ".gitignore",
      policy: "managed-block",
      marker: "gitignore",
      shared: "union",
      legacySignatures: {
        wholeFileHashes: [
          "sha256:648f12cb08d05e7bdf97ad4e69e36b7d2b76687d047811d58d196623fd9191bf",
          // Keep pre-engine-directory unmarked root files recognizable.
          "sha256:e82d7773f981dabccc1a0a8a31dad4feb26c2af4a65cc7d686bb2a0581ce0ecb",
          // The variant shipped before the block listed aidlc.settings.local.json.
          "sha256:9dca2d16f38509dacc876574d67391f84476e9eea349c2f5250b0325895ce0b8",
          // The variant shipped with a generic template above the AI-DLC lines.
          "sha256:e0829e668399a331c6fda7c267e3983b56ee23029ce8d5520394e3e70cf7d21d",
          // The variant shipped with notes above each group of lines.
          "sha256:88d6960720e5cd14f848a5e93ba9a503322518fe180c4bf55bcc3a6b8c151394",
          // The variant shipped before AI-DLC wrote the memory text into the steering file.
          "sha256:28a69800dcac189aa2a976820db237b45bcf6dd7d7e6d4fae5c1603225b9957a",
          // The variant shipped before the block ignored aidlc/active-memory/ (the
          // engine's copy of the active space's method).
          "sha256:a21217e44700aa0d6e703ebb524c4e07a3c4c12f7097d1923034b10b9a6d0549",
          // The variant shipped before the block ignored aidlc/.aidlc-request-text/
          // (a request the engine has not read yet).
          "sha256:6c6ff7641c17829d77fdd023f340b938db11dcc26c734a0c452d5213f9bd19cf",
          // The variant shipped before the block ignored .kiro/agents/aidlc-scoped-review-*.md
          // (a review's reviewer copy).
          "sha256:f9d49a8c823df8174ea7d8a83209380202e5673b5ee8c1ff6b9cce90bcfd550e",
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
          "sha256:4d539288363565feb6cf1a8d2468d1aca4373d46d354936d89e609f9862b2b9f",
          "sha256:8159f54fcfe2a2ef807227cb12a3c83327e3851672ea47294812dde411f0de69",
          "sha256:8d59f353b5575abe6ee12e8abd5ac75f55461bd7307d677d64388c16690e5afa",
          "sha256:aef608b826a4993d47e3de98679a81abe4823c7c73556def4a339c5cb92999e7",
          "sha256:b58a882d1b56bbb5cdb9a3c356b1428eb8d2593f4a9ca22118b98ca7cd0bae9c",
          "sha256:c5d2188b046cd75d8cb7214f32faa85cbc1539cddda4a0fae9bfe8fad90c237c",
          "sha256:dead4d5ea47849f489e05baeae418d5d26efc6cd14dd2201351a474376f8efde",
          "sha256:e01ac1caf52a59d25faf859a03cfb65b803853c99298bbcbc80ef565e7628de6",
          // The pre-v2-sync shipped variant (2.6.123 merge changed the bytes).
          "sha256:990d80744904bfa3f9923b8a04bbb2e69b454154346915edca1e1a4ef7e31c07",
          // Keep pre-engine-directory unmarked root files recognizable.
          "sha256:025c596b2f44b688a329d419b5cd39fd2ee2a6d6cae4e6491dc6cd0f663c04ea",
          "sha256:68be79dc053e88931557484ef37b7f63248cddcf02cb44db89c5bd2522980967",
          "sha256:6735312a6ece44f0ba65b949ede2a241669fa422db584dadb2a9ed57e4e43be7",
          // The 2.9.0 shipped variant (#1131 changed the onboarding record-dir shape).
          "sha256:94f27a88ddba31149876da0609e0eb9a36ce153f52f27898579c846daec2ff59",
          // The pre-neutral shipped variant (#1268 made the root block harness-neutral).
          "sha256:5f6f076a5a9d8a11e1078f568c9dee091f399d9999fae89e9dffa62d8697b797",
          // The variant shipped before the onboarding waited for the person to invoke AI-DLC.
          "sha256:6de1298dfa4c2b6916f66d372b844faf23481c8f258eedd595c1423dab8e106d",
        ],
      },
    },
  ],
  // Same core projection as kiro CLI.
  coreDirs: [
    { src: "tools", dst: "tools" },
    { src: "aidlc-common", dst: "aidlc-common" },
    { src: "knowledge", dst: "knowledge" },
    { src: "sensors", dst: "sensors" },
    { src: "scopes", dst: "scopes" },
    { src: "hooks", dst: "hooks" },
  ],

  harnessFiles: [],


  // The native release keys the persona shell deny on the `aidlc engine`
  // routes its conductor allow covers (delegate-shell-deny.ts), one rule per
  // distinct persona deny.
  nativeReplacements: [...new Map([...copyShellDeny].map(([agent, lines]) => [lines.join("\n"), agent])).entries()]
    .map(([from, agent]) => ({
      from,
      to: [
        ...shellDenyLines(nativeDelegateShellDeny(agent)),
        ...riskyFormDenyLines(["aidlc"]),
      ].join("\n"),
    })),

  onboarding: { dst: "AGENTS.md", projectRoot: true, harnessDst: "steering/aidlc-onboarding.md", fills: onboardingFills },

  rulesRename: KIRO_IDE_HOST_DATA.rulesFolder,

  skipRunnerGen: true,

  emit(ctx): void {
    emitAgents(ctx);
    ctx.emitCommands(kiroIdeCommandPath);
  },

  // Folder-drop with a v2 SessionStart registration under .kiro/hooks/. Kiro
  // has no host plugin store, but Kiro IDE 1.x and Kiro CLI v3 both execute
  // this JSON schema.
  plugin: { manifestDir: ".kiro-plugin", kind: "kiro-ide" },
};

export default manifest;
