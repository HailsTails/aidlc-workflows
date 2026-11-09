import type { HostData, AuthoredPlacement } from "../../projection/domain/host-surface.ts";
import type { HostTokenChoices } from "../../projection/domain/template-token.ts";

export const CURSOR_HOST_DATA = {
  productName: "Cursor",
  configNextStep: "open this project in Cursor, then run `/aidlc --doctor`",
  rulesFolder: null,
  hostShell: { env: ["CURSOR_AGENT"] },
  newChatStep: { text: "open a new chat, then type <entry>" },
  runnerFrontmatterAdditions: ["disable-model-invocation: true"],
} as const satisfies HostData;

export const CURSOR_TOKENS = {
  ["SKILL_INVOKE"]: null,
  ["OPTION_LETTERS"]: "A-E",
} as const satisfies HostTokenChoices;

export const CURSOR_AUTHORED_PLACEMENTS = [
  { source: "rules-aidlc.mdc", destination: ".cursor/rules/aidlc.mdc" },
  { source: "rules-aidlc-phase-ideation.mdc", destination: ".cursor/rules/aidlc-phase-ideation.mdc" },
  { source: "rules-aidlc-phase-inception.mdc", destination: ".cursor/rules/aidlc-phase-inception.mdc" },
  { source: "rules-aidlc-phase-construction.mdc", destination: ".cursor/rules/aidlc-phase-construction.mdc" },
  { source: "rules-aidlc-phase-operation.mdc", destination: ".cursor/rules/aidlc-phase-operation.mdc" },
  { source: "hooks/aidlc-cursor-adapter.ts", destination: ".cursor/hooks/aidlc-cursor-adapter.ts" },
  { source: "dot-gitignore", destination: ".gitignore" },
] as const satisfies readonly AuthoredPlacement[];
