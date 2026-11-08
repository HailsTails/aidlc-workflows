import { describe, expect, mock, test } from "bun:test";
import { kiroIdePermissionLines } from "./agent-renderer.ts";

const policy = { shellDeny: () => ["    - capability: shell", "      effect: deny",
  "      match:", '        - "forbidden engine route"'], riskyForms: ["$", ">"] };

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

describe("Kiro IDE persona permissions", () => {
  test("preserves tools, asks, shell denials, workspace writes and engine protection in order", () => {
    expect(kiroIdePermissionLines(policy)("aidlc-architect-agent")).toEqual(expectedLines);
  });

  test("limits the composer to its proposal while preserving every other permission", () => {
    expect(kiroIdePermissionLines(policy)("aidlc-composer-agent")).toEqual(
      [
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
        '        - "aidlc/spaces/*/intents/.aidlc-engine/composer-proposal.json"',
        "    - capability: fs_write", "      effect: deny", "      match:",
        '        - ".kiro/**"', '        - "aidlc/.aidlc-sessions/**"',
        '        - "aidlc/spaces/*/intents/*/.aidlc-engine/gate-words/**"',
    ]);
  });

  test("uses the same owner for plugin personas and asks its shell policy for their name", () => {
    const shellDeny = mock(policy.shellDeny);
    expect(kiroIdePermissionLines({ ...policy, shellDeny })("plugin-agent")).toEqual(expectedLines);
    expect(shellDeny).toHaveBeenCalledWith("plugin-agent");
  });
});
