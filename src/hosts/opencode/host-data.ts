import type { HostIdentity } from "../../kernel/host.ts";
import { accepted, type Result } from "../../kernel/result.ts";
import { distributionId, projectPath, type KernelRefusal } from "../../kernel/values.ts";
import type { HostData, AuthoredPlacement } from "../../projection/domain/host-surface.ts";
import type { HostTokenChoices } from "../../projection/domain/template-token.ts";

export const OPENCODE_BINDING_HEADING = "opencode";

export const OPENCODE_HOST_DATA = {
  productName: "opencode",
  configNextStep: "run `opencode`, then `/aidlc --doctor`",
  hookActivation: {
    recovery:
      "Quit opencode and start it again with just `opencode` in <folder>, then type <entry> to carry on.",
    notRunYet:
      "This is expected before your first opencode chat in this folder. If you already started one, quit " +
      "opencode and start it again with just `opencode` in <folder>, then run doctor again.",
    agentStep:
      "AI-DLC's opencode plugin is not loaded in this session. Do not retry and do not ask the " +
      "person to answer again. Show the person this line and end your turn: " +
      '"Quit opencode and start it again with just `opencode` in <folder>, then type <entry> to carry on."',
  },
  hostShell: { env: ["OPENCODE"] },
  newChatStep: { text: "start a new session, then type <entry>" },
  rulesFolder: null,
} as const satisfies HostData;

export const OPENCODE_TOKENS = {
  ["SKILL_INVOKE"]: null,
  ["OPTION_LETTERS"]: "A-E",
} as const satisfies HostTokenChoices;

export const OPENCODE_AUTHORED_PLACEMENTS = [
  { source: "dot-gitignore", destination: ".gitignore" },
  { source: "command/aidlc.md", destination: ".opencode/command/aidlc.md" },
] as const satisfies readonly AuthoredPlacement[];

export const openCodeHostIdentity = (): Result<HostIdentity, KernelRefusal> => {
  const distribution = distributionId("opencode");
  if (!distribution.ok) return distribution;
  const directory = projectPath(".aidlc");
  return directory.ok ? accepted({ distribution: distribution.value, directory: directory.value }) : directory;
};
