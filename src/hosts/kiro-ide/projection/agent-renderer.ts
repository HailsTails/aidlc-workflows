import type { DelegateShellPolicy } from "../../../projection/application/ports/delegate-shell.ts";

const composerProposalPath = "aidlc/spaces/*/intents/.aidlc-engine/composer-proposal.json";
const spacePaths = ["aidlc/spaces/**", ".aidlc/worktrees/*/aidlc/spaces/**"];
const quoted = (paths: readonly string[]) => paths.map((path) => `        - "${path}"`);

export const kiroIdePermissionLines = (policy: DelegateShellPolicy) => (agent: string): string[] => {
  const writePaths = agent === "aidlc-composer-agent" ? [composerProposalPath] : spacePaths;
  return [
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
    ...quoted(policy.riskyForms.map((form) => `bun .kiro/tools/aidlc*${form}*`)),
    ...policy.shellDeny(agent),
    "    - capability: fs_read",
    "      effect: allow",
    "      match:",
    `        - "**"`,
    "    - capability: filesystem",
    "      effect: allow",
    "      match:",
    ...quoted(writePaths),
    "    - capability: fs_write",
    "      effect: deny",
    "      match:",
    `        - ".kiro/**"`,
    `        - "aidlc/.aidlc-sessions/**"`,
    `        - "aidlc/spaces/*/intents/*/.aidlc-engine/gate-words/**"`,
  ];
};
