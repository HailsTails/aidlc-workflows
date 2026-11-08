import { z } from "zod";

const environmentMark = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*(?:=.*)?$/);

const hostSpecificLine = z.strictObject({
  env: z.array(environmentMark).min(1),
  text: z.string().min(1),
});

const hookActivation = z.strictObject({
  recovery: z.string().min(1),
  missedReply: z.string().optional(),
  missedReplyInHost: hostSpecificLine.optional(),
  missesReplies: z.literal(true).optional(),
  notRunYet: z.string().optional(),
  notRunYetCliFirst: hostSpecificLine.optional(),
  notRunInWorkflow: z.string().optional(),
  agentStep: z.string().optional(),
  agentStepInHost: hostSpecificLine.optional(),
  agentStepEdits: z.string().optional(),
  registration: z
    .strictObject({
      file: z.string(),
      missing: z.string(),
      invalid: z.string(),
      unwired: z.string(),
    })
    .optional(),
  startedInsideProject: z.string().optional(),
});

const statusLine = z.union([
  z.strictObject({ type: z.literal("command"), command: z.string().min(1) }),
  z.strictObject({ items: z.array(z.string()).min(1) }),
]);

export const HarnessProfileFileSchema = z.strictObject({
  schemaVersion: z.literal(2),
  distribution: z.string().regex(/^[a-z][a-z0-9-]*$/),
  productName: z.string().min(1),
  choiceName: z.string().optional(),
  choiceNote: z.string().optional(),
  harnessDir: z.string().regex(/^\.[a-z-]+$/),
  orchestratorSkillPath: z.string(),
  configNextStep: z.string().min(1),
  firstRunSteps: z.array(z.string()).optional(),
  cliFirst: z
    .strictObject({
      env: z.array(environmentMark).min(1),
      configNextStep: z.string(),
      firstRunSteps: z.array(z.string()),
    })
    .optional(),
  editorTerminalApp: z.string().optional(),
  hostShell: z.strictObject({ env: z.array(environmentMark).min(1) }).optional(),
  newChatStep: z
    .strictObject({ text: z.string().min(1), inHost: hostSpecificLine.optional() })
    .optional(),
  hookActivation: hookActivation.optional(),
  agentFinishRecorded: z.strictObject({ env: z.array(environmentMark).min(1) }).optional(),
  statusLine: statusLine.optional(),
  directiveMaxBytes: z.number().int().positive().optional(),
  questionOptions: z.number().int().min(2).max(5).optional(),
});

export type HarnessProfileFile = z.infer<typeof HarnessProfileFileSchema>;
