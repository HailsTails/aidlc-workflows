import { expect, mock, test } from "bun:test";
import { kiroIdeHostData } from "./host-data-renderer.ts";

const expectedLines = [
  'tools: ["read", "write", "shell"]', "includeMcpJson: true", "permissions:", "  rules:",
  "    - capability: shell", "      effect: allow", "      match:",
  '        - "bun .kiro/tools/aidlc-*"', '        - "bun .kiro/tools/aidlc.ts engine *"',
  '        - "bun --version"', "    - capability: shell", "      effect: ask", "      match:",
  '        - "bun .kiro/tools/aidlc.ts engine config set *"',
  '        - "bun .kiro/tools/aidlc.ts engine adapter *"',
  '        - "bun .kiro/tools/aidlc*$*"', '        - "bun .kiro/tools/aidlc*>*"',
  "    - capability: shell", "      effect: deny", "      match:", '        - "forbidden engine route"',
  "    - capability: fs_read", "      effect: allow", "      match:", '        - "**"',
  "    - capability: filesystem", "      effect: allow", "      match:",
  '        - "aidlc/spaces/**"', '        - ".aidlc/worktrees/*/aidlc/spaces/**"',
  "    - capability: fs_write", "      effect: deny", "      match:",
  '        - ".kiro/**"', '        - "aidlc/.aidlc-sessions/**"',
  '        - "aidlc/spaces/*/intents/*/.aidlc-engine/gate-words/**"',
];
test("Kiro IDE derives plugin permissions from the supplied policy on every render", () => {
  const shellDeny = mock(() => ["    - capability: shell", "      effect: deny",
    "      match:", `        - "forbidden engine route"`]);
  const hostData = kiroIdeHostData({ delegateShell: { shellDeny, riskyForms: ["$", ">"] } });
  expect(hostData.pluginAgentFrontmatter).toEqual({ copy: expectedLines, native: expectedLines });
  expect(shellDeny).toHaveBeenCalledTimes(1);
  expect(shellDeny).toHaveBeenCalledWith("plugin-agent");
  const changed = kiroIdeHostData({ delegateShell: {
    shellDeny: () => ["changed policy"], riskyForms: ["|"] } });
  expect(changed.pluginAgentFrontmatter?.copy).toContain("changed policy");
  expect(changed.pluginAgentFrontmatter?.copy).toContain('        - "bun .kiro/tools/aidlc*|*"');
  expect(changed.pluginAgentFrontmatter?.copy).not.toContain('        - "forbidden engine route"');
  expect(hostData.pluginAgentFrontmatter?.copy).toEqual(expectedLines);
});
