import { expect, mock, test } from "bun:test";
import type { DelegateShellFacts } from "../../../projection/application/ports/delegate-shell.ts";
import { kiroIdeHostData } from "./host-data-renderer.ts";

const facts: DelegateShellFacts = {
  engineNamespace: "engine", engineRoutes: [], dispatcherCommands: [], launcherGlobalFlags: [], workspaceNouns: [],
  workspaceRead: () => "other", admittedVerbs: () => ({}), engineRouteAdmission: () => "refused",
  lifecycleAdmission: () => "admitted", trustedCommand: () => "unused",
};
const expectedLines = [
  'tools: ["read", "write", "shell"]', "includeMcpJson: true", "permissions:", "  rules:",
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

const nativeExpectedLines = ["tools: [\"read\", \"write\", \"shell\"]","includeMcpJson: true","permissions:","  rules:","    - capability: shell","      effect: allow","      match:","        - \"aidlc engine *\"","        - \"bun --version\"","    - capability: shell","      effect: ask","      match:","        - \"aidlc engine config set *\"","        - \"aidlc engine adapter *\"","        - \"aidlc*$*\"","        - \"aidlc*`*\"","        - \"aidlc*>*\"","        - \"aidlc*<*\"","        - \"aidlc*&*\"","        - \"aidlc*@(*\"","        - \"aidlc*@{*\"","        - \"aidlc*\\n*\"",   "    - capability: shell", "      effect: deny", "      match:",
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

test("Kiro IDE derives plugin permissions from supplied facts on every render", () => {
  const admittedVerbs = mock(facts.admittedVerbs);
  const hostData = kiroIdeHostData({ delegateShellFacts: { ...facts, admittedVerbs } });
  expect(hostData.pluginAgentFrontmatter).toEqual({ copy: expectedLines, native: nativeExpectedLines });
  expect(admittedVerbs).toHaveBeenCalledTimes(2);
  expect(admittedVerbs).toHaveBeenCalledWith("plugin-agent");
  const changed = kiroIdeHostData({ delegateShellFacts: { ...facts, dispatcherCommands: ["--doctor"] } });
  expect(changed.pluginAgentFrontmatter?.copy).toContain('        - "bun .kiro/tools/aidlc.ts --doctor"');
  expect(hostData.pluginAgentFrontmatter?.copy).not.toContain('        - "bun .kiro/tools/aidlc.ts --doctor"');
  expect(hostData.pluginAgentFrontmatter?.copy).toEqual(expectedLines);
});
