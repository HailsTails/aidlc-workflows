import type { HostIdentity } from "../../kernel/host.ts";
import { accepted, type Result } from "../../kernel/result.ts";
import { distributionId, projectPath, type KernelRefusal } from "../../kernel/values.ts";
import type { HostData, AuthoredPlacement } from "../../projection/domain/host-surface.ts";
import type { HostTokenChoices } from "../../projection/domain/template-token.ts";
export const KIRO_PROMPT_LINES: readonly string[] = [
  `tools: ["read", "write", "shell"]`,
  "includeMcpJson: true",
];
const KIRO_V3_WAYS_BACK =
  "type /upgrade-agent and choose the workspace agents, then quit Kiro and start `kiro-cli --v3` again " +
  "in this folder; or, to switch this project to Kiro, quit Kiro, run `{{INVOKE}} config --harness kiro` " +
  "in a terminal in this folder and, once it has finished, start `kiro-cli --v3`; or quit Kiro and start " +
  "it again in this folder with: kiro-cli --v2 --agent aidlc (Kiro CLI 2.21.4 or later; for an older one, " +
  "see the AI-DLC Kiro CLI guide)";

export const KIRO_HOST_DATA = {
  productName: "Kiro CLI",
  configNextStep: "run `kiro-cli --v2` (Kiro CLI 2.21.4 or later; for an older one, see the AI-DLC Kiro CLI guide), then `/aidlc --doctor`",
  rulesFolder: "steering",
  hookActivation: {
    recovery:
      "In Kiro CLI, type /agent and pick aidlc, then carry on. If aidlc is not in that list, Kiro is on its " +
      `v3 engine with this project's agent files not upgraded: ${KIRO_V3_WAYS_BACK}. From an ACP client, start ` +
      "`kiro-cli acp --agent-engine v2`; or switch this project to Kiro with `{{INVOKE}} config --harness kiro` " +
      "in a terminal in this folder and start `kiro-cli acp --agent-engine v3` with Kiro's client hooks " +
      "turned on (the AI-DLC guide for Kiro names them).",
    missedReply:
      "If the person already replied, that reply was not recorded for this question. Tell them exactly this, " +
      "with nothing about why: \"Your answer didn't reach AI-DLC. Type /agent and pick aidlc, then give it once " +
      `more. If aidlc is not in that list, ${KIRO_V3_WAYS_BACK}, and give it there."`,
    notRunYet:
      "This is expected before your first Kiro CLI chat in this folder. If you already started one, type /agent " +
      `and pick aidlc; if aidlc is not in that list, ${KIRO_V3_WAYS_BACK}. Then run doctor again.`,
    agentStep:
      "Kiro is not running this project's aidlc agent in this session. You cannot change that " +
      "from inside it: do not approve, retry, or ask the person to answer again. Show the person this " +
      `line: "Type /agent and pick aidlc, then carry on. If aidlc is not in that list, ${KIRO_V3_WAYS_BACK}, ` +
      'and type <entry> there to carry on." Then end your turn.',
  },
  hostShell: { env: ["KIRO_SESSION_ID"] },
  newChatStep: { text: "type /chat new, then <entry>" },
  pluginAgentFrontmatter: { copy: KIRO_PROMPT_LINES, native: KIRO_PROMPT_LINES },
} as const satisfies HostData;

export const KIRO_TOKENS = {
  ["SKILL_INVOKE"]: null,
  ["OPTION_LETTERS"]: "A-E",
} as const satisfies HostTokenChoices;

export const KIRO_AUTHORED_PLACEMENTS = [
  { source: "hooks/aidlc-kiro-adapter.ts", destination: ".kiro/hooks/aidlc-kiro-adapter.ts" },
  { source: "settings/mcp.json", destination: ".kiro/settings/mcp.json" },
  { source: "dot-gitignore", destination: ".gitignore" },
] as const satisfies readonly AuthoredPlacement[];

export const KIRO_BINDING_HEADING = "Kiro CLI";

export const kiroHostIdentity = (): Result<HostIdentity, KernelRefusal> => {
  const distribution = distributionId("kiro");
  if (!distribution.ok) return distribution;
  const directory = projectPath(".kiro");
  return directory.ok ? accepted({ distribution: distribution.value, directory: directory.value }) : directory;
};
