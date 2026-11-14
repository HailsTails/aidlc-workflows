import type { DelegateShellFacts } from "../../projection/application/ports/delegate-shell.ts";
import { copyChannelDelegateShellDeny, nativeDelegateShellDeny, riskyFormDenyLines, shellDenyLines }
  from "./projection/delegate-shell-deny.ts";
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

const nativeReplacements = (facts: DelegateShellFacts) => {
  const copy = [...DELEGATION_AGENTS, "plugin-agent"].map((agent) => ({ agent, lines: [
    ...shellDenyLines(copyChannelDelegateShellDeny({ facts, harnessDir: ".kiro", agent })),
    ...riskyFormDenyLines(["bun .kiro/tools/aidlc"]),
  ].join("\n") }));
  const distinct = new Map(copy.map(({ agent, lines }) => [lines, agent]));
  return [...distinct].map(([from, agent]) => ({ from, to: [
    ...shellDenyLines(nativeDelegateShellDeny({ facts, agent })),
    ...riskyFormDenyLines(["aidlc"]),
  ].join("\n") }));
};
import type { HostDistribution } from "../../packaging/domain/payload.ts";
import { accepted, type Result } from "../../kernel/result.ts";
import { contentHash, projectPath, type ContentHash, type KernelRefusal } from "../../kernel/values.ts";

const GITIGNORE_PRIOR_HASHES = [
  "sha256:648f12cb08d05e7bdf97ad4e69e36b7d2b76687d047811d58d196623fd9191bf",
  "sha256:e82d7773f981dabccc1a0a8a31dad4feb26c2af4a65cc7d686bb2a0581ce0ecb",
  "sha256:9dca2d16f38509dacc876574d67391f84476e9eea349c2f5250b0325895ce0b8",
  "sha256:e0829e668399a331c6fda7c267e3983b56ee23029ce8d5520394e3e70cf7d21d",
  "sha256:88d6960720e5cd14f848a5e93ba9a503322518fe180c4bf55bcc3a6b8c151394",
  "sha256:28a69800dcac189aa2a976820db237b45bcf6dd7d7e6d4fae5c1603225b9957a",
  "sha256:a21217e44700aa0d6e703ebb524c4e07a3c4c12f7097d1923034b10b9a6d0549",
  "sha256:6c6ff7641c17829d77fdd023f340b938db11dcc26c734a0c452d5213f9bd19cf",
  "sha256:f9d49a8c823df8174ea7d8a83209380202e5673b5ee8c1ff6b9cce90bcfd550e"
];
const AGENTS_PRIOR_HASHES = [
  "sha256:4d539288363565feb6cf1a8d2468d1aca4373d46d354936d89e609f9862b2b9f",
  "sha256:8159f54fcfe2a2ef807227cb12a3c83327e3851672ea47294812dde411f0de69",
  "sha256:8d59f353b5575abe6ee12e8abd5ac75f55461bd7307d677d64388c16690e5afa",
  "sha256:aef608b826a4993d47e3de98679a81abe4823c7c73556def4a339c5cb92999e7",
  "sha256:b58a882d1b56bbb5cdb9a3c356b1428eb8d2593f4a9ca22118b98ca7cd0bae9c",
  "sha256:c5d2188b046cd75d8cb7214f32faa85cbc1539cddda4a0fae9bfe8fad90c237c",
  "sha256:dead4d5ea47849f489e05baeae418d5d26efc6cd14dd2201351a474376f8efde",
  "sha256:e01ac1caf52a59d25faf859a03cfb65b803853c99298bbcbc80ef565e7628de6",
  "sha256:990d80744904bfa3f9923b8a04bbb2e69b454154346915edca1e1a4ef7e31c07",
  "sha256:025c596b2f44b688a329d419b5cd39fd2ee2a6d6cae4e6491dc6cd0f663c04ea",
  "sha256:68be79dc053e88931557484ef37b7f63248cddcf02cb44db89c5bd2522980967",
  "sha256:6735312a6ece44f0ba65b949ede2a241669fa422db584dadb2a9ed57e4e43be7",
  "sha256:94f27a88ddba31149876da0609e0eb9a36ce153f52f27898579c846daec2ff59",
  "sha256:5f6f076a5a9d8a11e1078f568c9dee091f399d9999fae89e9dffa62d8697b797",
  "sha256:6de1298dfa4c2b6916f66d372b844faf23481c8f258eedd595c1423dab8e106d"
];

const LISTING = {
  "choiceNote": "Kiro IDE and Kiro CLI on its v3 engine",
  "firstRunSteps": [
    "1. Open this folder in Kiro IDE. If the Restricted Mode banner shows at the",
    "   top of the window and you know what is in this folder, select Manage on",
    "   it, then Trust.",
    "2. Run \"Developer: Reload Window\" from the Command Palette",
    "   (Ctrl+Shift+P, or Cmd+Shift+P on macOS) so Kiro loads the AIDLC hooks",
    "   and the aidlc agent.",
    "3. Choose the aidlc agent in the chat panel's agent picker.",
    "4. /aidlc \"what you want built\"  describe your first intent",
    "",
    "Using Kiro CLI instead? Start `kiro-cli --v3` in this folder. If Kiro asks",
    "whether you trust this workspace and you know what is in this folder,",
    "choose \"Trust, continue\". Then step 4."
  ],
  "editorTerminalApp": "kiro",
  "cliFirst": {
    "env": [
      "TERM_PROGRAM=kiro",
      "VSCODE_IPC_HOOK",
      "VSCODE_PID"
    ],
    "configNextStep": "start `kiro-cli --v3` in the project; if Kiro asks whether you trust this workspace and you know what is in this folder, choose \"Trust, continue\"; then run `/aidlc --doctor` (in Kiro IDE, open this project instead; if the Restricted Mode banner shows at the top of the window and you know what is in this folder, select Manage on it, then Trust; run `Developer: Reload Window` from the Command Palette (Ctrl+Shift+P, or Cmd+Shift+P on macOS), choose the aidlc agent in the chat panel's agent picker, then run `/aidlc --doctor`)",
    "firstRunSteps": [
      "1. Start `kiro-cli --v3` in this folder. If Kiro asks whether you trust",
      "   this workspace and you know what is in this folder, choose",
      "   \"Trust, continue\".",
      "2. /aidlc \"what you want built\"  describe your first intent",
      "",
      "Using Kiro IDE instead? Open this folder in Kiro IDE. If the Restricted",
      "Mode banner shows at the top of the window and you know what is in this",
      "folder, select Manage on it, then Trust. Run \"Developer: Reload Window\"",
      "from the Command Palette (Ctrl+Shift+P, or Cmd+Shift+P on macOS), choose",
      "the aidlc agent in the chat panel's agent picker, then step 2."
    ]
  }
};

const priorHashes = (values: readonly string[]): Result<readonly ContentHash[], KernelRefusal> =>
  values.reduce<Result<readonly ContentHash[], KernelRefusal>>((hashes, raw) => {
    if (!hashes.ok) return hashes;
    const hash = contentHash(raw);
    return hash.ok ? accepted([...hashes.value, hash.value]) : hash;
  }, accepted([]));

export const kiroIdeDistribution = ({ delegateShellFacts }: {
  readonly delegateShellFacts: DelegateShellFacts;
}): Result<HostDistribution, KernelRefusal> => {
  const gitignore = projectPath(".gitignore");
  if (!gitignore.ok) return gitignore;
  const agents = projectPath("AGENTS.md");
  if (!agents.ok) return agents;
  const directory = projectPath(".kiro");
  if (!directory.ok) return directory;
  const workspace = projectPath("aidlc");
  if (!workspace.ok) return workspace;
  const gitignoreHashes = priorHashes(GITIGNORE_PRIOR_HASHES);
  if (!gitignoreHashes.ok) return gitignoreHashes;
  const agentsHashes = priorHashes(AGENTS_PRIOR_HASHES);
  if (!agentsHashes.ok) return agentsHashes;
  return accepted({
    layout: {
      rootIntegrations: [
        { path: gitignore.value, policy: "managed-block", marker: "gitignore", sharing: "union", presence: "required" },
        { path: agents.value, policy: "managed-block", marker: "agents", sharing: "identical", presence: "required" },
      ],
      managedDirectories: [
        { path: directory.value, ownership: "shipped-files-only" },
        { path: workspace.value, ownership: "shipped-files-only" },
      ],
    },
    priorIntegrations: [
      { integration: gitignore.value, wholeFileHashes: gitignoreHashes.value, entryHashes: {} },
      { integration: agents.value, wholeFileHashes: agentsHashes.value, entryHashes: {} },
    ],
    listing: LISTING,
    native: { replacements: nativeReplacements(delegateShellFacts), copyOnly: [], permissionsLine: "exact-reads" },
    plugin: {
      format: "kiro-ide", manifestDir: ".kiro-plugin", marketplaceDir: ".kiro-plugin", catalogue: "none",
      installRoots: [".gitignore", ".kiro", "AGENTS.md", "aidlc"],
    },
  });
};
