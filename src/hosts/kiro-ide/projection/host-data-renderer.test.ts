import { promptLines } from "../../../projection/domain/native-policy.ts";
import { brand } from "../../../kernel/brand.ts";
import type { MethodSourcePath } from "../../../workflow-definition/domain/method-source.ts";
import type { NativePolicyPrompt } from "../../../projection/domain/native-policy.ts";
import { expect, mock, test } from "bun:test";
import { DELEGATE_SHELL_FACTS } from "../../../projection/fixtures/delegate-shell-facts.fixture.ts";
import type { DelegateShellFacts } from "../../../projection/application/ports/delegate-shell.ts";
import { kiroIdeHostData } from "./host-data-renderer.ts";

const facts: DelegateShellFacts = {
  engineNamespace: "engine", engineRoutes: [], dispatcherCommands: [], launcherGlobalFlags: [], workspaceNouns: [],
  workspaceRead: () => "other", admittedVerbs: () => ({}), engineRouteAdmission: () => "refused",
  lifecycleAdmission: () => "admitted", trustedCommand: DELEGATE_SHELL_FACTS.trustedCommand,
};
const expectedLines = [
  'tools: ["read", "write", "shell"]', "includeMcpJson: true", "resources:", "permissions:", "  rules:",
  "    - capability: shell", "      effect: allow", "      match:",
  '        - "bun .kiro/tools/aidlc-*"', '        - "bun .kiro/tools/aidlc.ts engine *"',
  '        - "bun --version"', "    - capability: shell", "      effect: ask", "      match:",
  '        - "bun .kiro/tools/aidlc.ts engine config set *"',
  '        - "bun .kiro/tools/aidlc.ts engine adapter *"',
  '        - "bun .kiro/tools/aidlc*$*"', '        - "bun .kiro/tools/aidlc*`*"',
  '        - "bun .kiro/tools/aidlc*>*"', '        - "bun .kiro/tools/aidlc*<*"',
  '        - "bun .kiro/tools/aidlc*&*"', '        - "bun .kiro/tools/aidlc*@(*"',
  '        - "bun .kiro/tools/aidlc*@{*"', '        - "bun .kiro/tools/aidlc*\\n*"',
  "    - capability: shell", "      effect: deny", "      match:",
  '        - "bun .kiro/tools/aidlc-*"', '        - "bun .kiro/tools/aidlc.ts engine *"', "      exclude:",
  "    - capability: shell", "      effect: deny", "      match:",
  '        - "bun .kiro/tools/aidlc*$*"', '        - "bun .kiro/tools/aidlc*`*"',
  '        - "bun .kiro/tools/aidlc*>*"', '        - "bun .kiro/tools/aidlc*<*"',
  '        - "bun .kiro/tools/aidlc*&*"', '        - "bun .kiro/tools/aidlc*@(*"',
  '        - "bun .kiro/tools/aidlc*@{*"', '        - "bun .kiro/tools/aidlc*\\n*"',
  "    - capability: fs_read", "      effect: allow", "      match:", '        - "**"',
  "    - capability: filesystem", "      effect: allow", "      match:",
  '        - "aidlc/spaces/**"', '        - ".aidlc/worktrees/*/aidlc/spaces/**"',
  "    - capability: fs_write", "      effect: deny", "      match:",
  '        - ".kiro/**"', '        - "aidlc/.aidlc-sessions/**"',
  '        - "aidlc/spaces/*/intents/*/.aidlc-engine/gate-words/**"',
];

const nativeExpectedLines = [
  "tools: [\"read\", \"write\", \"shell\"]",
  "includeMcpJson: true", "resources:",
  "permissions:",
  "  rules:",
  "    - capability: shell",
  "      effect: allow",
  "      match:",
  "        - \"aidlc engine *\"",
  "        - \"bun --version\"",
  "    - capability: shell",
  "      effect: ask",
  "      match:",
  "        - \"aidlc engine config set *\"",
  "        - \"aidlc engine adapter *\"",
  "        - \"aidlc*$*\"",
  "        - \"aidlc*`*\"",
  "        - \"aidlc*>*\"",
  "        - \"aidlc*<*\"",
  "        - \"aidlc*&*\"",
  "        - \"aidlc*@(*\"",
  "        - \"aidlc*@{*\"",
  "        - \"aidlc*\\n*\"",
  "    - capability: shell",
  "      effect: deny",
  "      match:",
  "        - \"aidlc engine *\"",
  "      exclude:",
  "    - capability: shell",
  "      effect: deny",
  "      match:",
  "        - \"aidlc*$*\"",
  "        - \"aidlc*`*\"",
  "        - \"aidlc*>*\"",
  "        - \"aidlc*<*\"",
  "        - \"aidlc*&*\"",
  "        - \"aidlc*@(*\"",
  "        - \"aidlc*@{*\"",
  "        - \"aidlc*\\n*\"",
  "    - capability: fs_read",
  "      effect: allow",
  "      match:",
  "        - \"**\"",
  "    - capability: filesystem",
  "      effect: allow",
  "      match:",
  "        - \"aidlc/spaces/**\"",
  "        - \".aidlc/worktrees/*/aidlc/spaces/**\"",
  "    - capability: fs_write",
  "      effect: deny",
  "      match:",
  "        - \".kiro/**\"",
  "        - \"aidlc/.aidlc-sessions/**\"",
  "        - \"aidlc/spaces/*/intents/*/.aidlc-engine/gate-words/**\""
];;

test("Kiro IDE derives plugin permissions from supplied facts on every render", () => {
  const admittedVerbs = mock(facts.admittedVerbs);
  const hostData = kiroIdeHostData({ sharedKnowledge: { documents: [], formatDocuments: new Set() }, delegateShellFacts: { ...facts, admittedVerbs } });
  expect(hostData.pluginAgentFrontmatter?.copy).toEqual(expectedLines);
  expect(hostData.pluginAgentFrontmatter?.native).toEqual<Pick<NativePolicyPrompt, "kind" | "lines" | "obligation">>({ kind: "native-policy", lines: nativeExpectedLines, obligation: "    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc-*\"\n        - \"bun .kiro/tools/aidlc.ts engine *\"\n      exclude:\n    - capability: shell\n      effect: deny\n      match:\n        - \"bun .kiro/tools/aidlc*$*\"\n        - \"bun .kiro/tools/aidlc*`*\"\n        - \"bun .kiro/tools/aidlc*>*\"\n        - \"bun .kiro/tools/aidlc*<*\"\n        - \"bun .kiro/tools/aidlc*&*\"\n        - \"bun .kiro/tools/aidlc*@(*\"\n        - \"bun .kiro/tools/aidlc*@{*\"\n        - \"bun .kiro/tools/aidlc*\\n*\"" });
  expect(admittedVerbs).toHaveBeenCalledTimes(5);
  expect(admittedVerbs).toHaveBeenCalledWith("plugin-agent");
  const changed = kiroIdeHostData({ sharedKnowledge: { documents: [], formatDocuments: new Set() }, delegateShellFacts: { ...facts, dispatcherCommands: ["--doctor"] } });
  expect(changed.pluginAgentFrontmatter?.copy).toContain('        - "bun .kiro/tools/aidlc.ts --doctor"');
  expect(hostData.pluginAgentFrontmatter?.copy).not.toContain('        - "bun .kiro/tools/aidlc.ts --doctor"');
  expect(hostData.pluginAgentFrontmatter?.copy).toEqual(expectedLines);
});

// #4107: plugin delegates need the same explicit shared resources as built-in helpers.
test("plugin personas preload only sorted shared non-format core knowledge", () => {
  const document = (path: string) => ({ source: brand<MethodSourcePath>(path),
    owner: { kind: "core" as const }, audience: { kind: "shared" as const } });
  const sharedKnowledge = { documents: [document("knowledge/aidlc-shared/z.md"),
    document("knowledge/aidlc-shared/a.md"), document("knowledge/aidlc-shared/format.md"),
    document("knowledge/aidlc-shared/nested/hidden.md"), document("knowledge/aidlc-shared/not.txt")],
    formatDocuments: new Set(["format.md"]) };
  const data = kiroIdeHostData({ delegateShellFacts: facts, sharedKnowledge });
  for (const lines of [data.pluginAgentFrontmatter?.copy,
    promptLines(data.pluginAgentFrontmatter?.native ?? [])]) {
    expect(lines?.slice(0, 6)).toEqual(['tools: ["read", "write", "shell"]', "includeMcpJson: true", "resources:", '  - "file://.kiro/knowledge/aidlc-shared/a.md"',
      '  - "file://.kiro/knowledge/aidlc-shared/z.md"', "permissions:"]);
  }
});
