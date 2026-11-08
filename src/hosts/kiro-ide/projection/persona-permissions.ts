export type PersonaShell = {
  readonly shellDeny: (persona: string) => readonly string[];
  readonly riskyShellForms: readonly string[];
};

export const COMPOSER_AGENT = "aidlc-composer-agent";

export const PLUGIN_AGENT = "plugin-agent";

const COMPOSER_PROPOSAL = "aidlc/spaces/*/intents/.aidlc-engine/composer-proposal.json";

const SPACE_PATHS: readonly string[] = ["aidlc/spaces/**", ".aidlc/worktrees/*/aidlc/spaces/**"];

const quoted = (paths: readonly string[]): readonly string[] =>
  paths.map((path) => `        - "${path}"`);

const writePathsOf = (persona: string): readonly string[] =>
  persona === COMPOSER_AGENT ? [COMPOSER_PROPOSAL] : SPACE_PATHS;

const shellRules = (shell: PersonaShell, persona: string): readonly string[] => [
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
  ...quoted(shell.riskyShellForms.map((form) => `bun .kiro/tools/aidlc*${form}*`)),
  ...shell.shellDeny(persona),
];

const fileRules = (persona: string): readonly string[] => [
  "    - capability: fs_read",
  "      effect: allow",
  "      match:",
  `        - "**"`,
  "    - capability: filesystem",
  "      effect: allow",
  "      match:",
  ...quoted(writePathsOf(persona)),
  "    - capability: fs_write",
  "      effect: deny",
  "      match:",
  `        - ".kiro/**"`,
  `        - "aidlc/.aidlc-sessions/**"`,
  `        - "aidlc/spaces/*/intents/*/.aidlc-engine/gate-words/**"`,
];

export const personaPermissionLines =
  (shell: PersonaShell) =>
  (persona: string): readonly string[] => [
    "permissions:",
    "  rules:",
    ...shellRules(shell, persona),
    ...fileRules(persona),
  ];
