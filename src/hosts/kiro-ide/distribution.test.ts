import { expect, mock, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { hash, path } from "../../kernel/fixtures/values.fixture.ts";
import { accepted } from "../../kernel/result.ts";
import { kiroIdeDistribution } from "./distribution.ts";
import type { HostDistribution } from "../../packaging/domain/payload.ts";

import type { DelegateShellFacts } from "../../projection/application/ports/delegate-shell.ts";

const facts: DelegateShellFacts = {
  engineNamespace: "engine", engineRoutes: [], dispatcherCommands: [], launcherGlobalFlags: [], workspaceNouns: [],
  workspaceRead: () => "other", admittedVerbs: () => ({}), engineRouteAdmission: () => "refused",
  lifecycleAdmission: () => "admitted", trustedCommand: () => "aidlc engine *",
};
const EXPECTED_DISTRIBUTION: HostDistribution = {
    layout: {
      rootIntegrations: [
        { path: path(".gitignore"), policy: "managed-block", marker: "gitignore", sharing: "union", presence: "required" },
        { path: path("AGENTS.md"), policy: "managed-block", marker: "agents", sharing: "identical", presence: "required" },
      ],
      managedDirectories: [
        { path: path(".kiro"), ownership: "shipped-files-only" },
        { path: path("aidlc"), ownership: "shipped-files-only" },
      ],
    },
    priorIntegrations: [
      { integration: path(".gitignore"), wholeFileHashes: [
        hash("sha256:648f12cb08d05e7bdf97ad4e69e36b7d2b76687d047811d58d196623fd9191bf"),
        hash("sha256:e82d7773f981dabccc1a0a8a31dad4feb26c2af4a65cc7d686bb2a0581ce0ecb"),
        hash("sha256:9dca2d16f38509dacc876574d67391f84476e9eea349c2f5250b0325895ce0b8"),
        hash("sha256:e0829e668399a331c6fda7c267e3983b56ee23029ce8d5520394e3e70cf7d21d"),
        hash("sha256:88d6960720e5cd14f848a5e93ba9a503322518fe180c4bf55bcc3a6b8c151394"),
        hash("sha256:28a69800dcac189aa2a976820db237b45bcf6dd7d7e6d4fae5c1603225b9957a"),
        hash("sha256:a21217e44700aa0d6e703ebb524c4e07a3c4c12f7097d1923034b10b9a6d0549"),
        hash("sha256:6c6ff7641c17829d77fdd023f340b938db11dcc26c734a0c452d5213f9bd19cf"),
        hash("sha256:f9d49a8c823df8174ea7d8a83209380202e5673b5ee8c1ff6b9cce90bcfd550e"),
      ], entryHashes: {} },
      { integration: path("AGENTS.md"), wholeFileHashes: [
        hash("sha256:4d539288363565feb6cf1a8d2468d1aca4373d46d354936d89e609f9862b2b9f"),
        hash("sha256:8159f54fcfe2a2ef807227cb12a3c83327e3851672ea47294812dde411f0de69"),
        hash("sha256:8d59f353b5575abe6ee12e8abd5ac75f55461bd7307d677d64388c16690e5afa"),
        hash("sha256:aef608b826a4993d47e3de98679a81abe4823c7c73556def4a339c5cb92999e7"),
        hash("sha256:b58a882d1b56bbb5cdb9a3c356b1428eb8d2593f4a9ca22118b98ca7cd0bae9c"),
        hash("sha256:c5d2188b046cd75d8cb7214f32faa85cbc1539cddda4a0fae9bfe8fad90c237c"),
        hash("sha256:dead4d5ea47849f489e05baeae418d5d26efc6cd14dd2201351a474376f8efde"),
        hash("sha256:e01ac1caf52a59d25faf859a03cfb65b803853c99298bbcbc80ef565e7628de6"),
        hash("sha256:990d80744904bfa3f9923b8a04bbb2e69b454154346915edca1e1a4ef7e31c07"),
        hash("sha256:025c596b2f44b688a329d419b5cd39fd2ee2a6d6cae4e6491dc6cd0f663c04ea"),
        hash("sha256:68be79dc053e88931557484ef37b7f63248cddcf02cb44db89c5bd2522980967"),
        hash("sha256:6735312a6ece44f0ba65b949ede2a241669fa422db584dadb2a9ed57e4e43be7"),
        hash("sha256:94f27a88ddba31149876da0609e0eb9a36ce153f52f27898579c846daec2ff59"),
        hash("sha256:5f6f076a5a9d8a11e1078f568c9dee091f399d9999fae89e9dffa62d8697b797"),
        hash("sha256:6de1298dfa4c2b6916f66d372b844faf23481c8f258eedd595c1423dab8e106d"),
      ], entryHashes: {} },
    ],
    listing: {
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
},
    native: { replacements: [
  {
    "from": "    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-*\"\n        - \"bun .kiro/tools/aidlc.ts engine *\"\n      exclude:\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc*$*\"\n        - \"bun .kiro/tools/aidlc*`*\"\n        - \"bun .kiro/tools/aidlc*>*\"\n        - \"bun .kiro/tools/aidlc*<*\"\n        - \"bun .kiro/tools/aidlc*&*\"\n        - \"bun .kiro/tools/aidlc*@(*\"\n        - \"bun .kiro/tools/aidlc*@{*\"\n        - \"bun .kiro/tools/aidlc*\\n*\"",
    "to": "    - capability: shell\n      effect: deny\n      match:\n        - \"aidlc engine *\"\n      exclude:\n    - capability: shell\n      effect: deny\n      match:\n        - \"aidlc*$*\"\n        - \"aidlc*`*\"\n        - \"aidlc*>*\"\n        - \"aidlc*<*\"\n        - \"aidlc*&*\"\n        - \"aidlc*@(*\"\n        - \"aidlc*@{*\"\n        - \"aidlc*\\n*\""
  }
], copyOnly: [], permissionsLine: "exact-reads" },
    plugin: {
      format: "kiro-ide", manifestDir: ".kiro-plugin", marketplaceDir: ".kiro-plugin", catalogue: "none",
      installRoots: [".gitignore", ".kiro", "AGENTS.md", "aidlc"],
    },
  };

test("Kiro IDE declares the exact roots, prior shapes, listing and plugin distribution", () => {
  expect(kiroIdeDistribution({ delegateShellFacts: facts })).toEqual(accepted(EXPECTED_DISTRIBUTION));
});

test("Kiro IDE's declared top-level directories match the verified legacy descriptor", () => {
  const distribution = accept(kiroIdeDistribution({ delegateShellFacts: facts }));
  expect(distribution.layout.managedDirectories).toHaveLength(2);
  expect([
    distribution.layout.managedDirectories[0]?.path,
    distribution.layout.managedDirectories[1]?.path,
  ]).toEqual([path(".kiro"), path("aidlc")]);
});

test("identical persona denials collapse once, using the supplied facts for the last matching agent", () => {
  const admittedVerbs = mock(facts.admittedVerbs);
  const distribution = accept(kiroIdeDistribution({ delegateShellFacts: { ...facts, admittedVerbs } }));
  expect(distribution.native.replacements).toHaveLength(1);
  expect(admittedVerbs).toHaveBeenCalledTimes(31);
  expect(admittedVerbs).toHaveBeenNthCalledWith(1, "aidlc-composer-agent");
  expect(admittedVerbs).toHaveBeenNthCalledWith(29, "plugin-agent");
  expect(admittedVerbs).toHaveBeenNthCalledWith(31, "plugin-agent");
});
