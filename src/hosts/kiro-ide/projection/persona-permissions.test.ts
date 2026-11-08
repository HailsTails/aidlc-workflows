import { describe, expect, test } from "bun:test";
import {
  COMPOSER_AGENT,
  personaPermissionLines,
  PLUGIN_AGENT,
  type PersonaShell,
} from "./persona-permissions.ts";

const shell: PersonaShell = {
  shellDeny: (persona) => [`    - deny for ${persona}`],
  riskyShellForms: [">"],
};

const lines = personaPermissionLines(shell);

describe("personaPermissionLines", () => {
  test("grants the tools, allows the AI-DLC commands, asks on risky forms, and fences the engine's trees", () => {
    expect(lines("aidlc-architect-agent")).toEqual([
      `tools: ["read", "write", "shell"]`,
      "includeMcpJson: true",
      "permissions:",
      "  rules:",
      "    - capability: shell",
      "      effect: allow",
      "      match:",
      `        - "bun .kiro/tools/aidlc-*"`,
      `        - "bun .kiro/tools/aidlc.ts engine *"`,
      `        - "bun --version"`,
      "    - capability: shell",
      "      effect: ask",
      "      match:",
      `        - "bun .kiro/tools/aidlc.ts engine config set *"`,
      `        - "bun .kiro/tools/aidlc.ts engine adapter *"`,
      `        - "bun .kiro/tools/aidlc*>*"`,
      "    - deny for aidlc-architect-agent",
      "    - capability: fs_read",
      "      effect: allow",
      "      match:",
      `        - "**"`,
      "    - capability: filesystem",
      "      effect: allow",
      "      match:",
      `        - "aidlc/spaces/**"`,
      `        - ".aidlc/worktrees/*/aidlc/spaces/**"`,
      "    - capability: fs_write",
      "      effect: deny",
      "      match:",
      `        - ".kiro/**"`,
      `        - "aidlc/.aidlc-sessions/**"`,
      `        - "aidlc/spaces/*/intents/*/.aidlc-engine/gate-words/**"`,
    ]);
  });

  test("lets the composer write only its proposal", () => {
    expect(lines(COMPOSER_AGENT)).toEqual(
      expect.arrayContaining([`        - "aidlc/spaces/*/intents/.aidlc-engine/composer-proposal.json"`]),
    );
    expect(lines(COMPOSER_AGENT)).not.toContain(`        - "aidlc/spaces/**"`);
  });

  test("gives a plugin's agent the deny it stands under", () => {
    expect(lines(PLUGIN_AGENT)).toContain("    - deny for plugin-agent");
  });
});
