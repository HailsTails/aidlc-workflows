import type { DistributionId, RelativePath } from "../../kernel/values.ts";

export type EnvironmentMark = {
  readonly variable: string;
  readonly value: string | null;
};

export type HostShell = {
  readonly marks: readonly EnvironmentMark[];
};

export type HostSpecificLine = {
  readonly marks: readonly EnvironmentMark[];
  readonly text: string;
};

export type FirstRunGuidance = {
  readonly configNextStep: string;
  readonly firstRunSteps: readonly string[] | null;
};

export type CliFirstGuidance = FirstRunGuidance & {
  readonly marks: readonly EnvironmentMark[];
};

export type HookRegistrationRepair = {
  readonly file: RelativePath;
  readonly missing: string;
  readonly invalid: string;
  readonly unwired: string;
};

export type HookActivation = {
  readonly recovery: string;
  readonly missedReply: string | null;
  readonly missedReplyInHost: HostSpecificLine | null;
  readonly missesReplies: boolean;
  readonly notRunYet: string | null;
  readonly notRunYetCliFirst: HostSpecificLine | null;
  readonly notRunInWorkflow: string | null;
  readonly agentStep: string | null;
  readonly agentStepInHost: HostSpecificLine | null;
  readonly agentStepEdits: RelativePath | null;
  readonly registration: HookRegistrationRepair | null;
  readonly startedInsideProject: string | null;
};

export type StatusLineSetting =
  | { readonly kind: "command"; readonly command: string }
  | { readonly kind: "items"; readonly items: readonly string[] };

export type NewChatStep = {
  readonly text: string;
  readonly inHost: HostSpecificLine | null;
};

export type HarnessProfile = {
  readonly distribution: DistributionId;
  readonly productName: string;
  readonly choiceName: string | null;
  readonly choiceNote: string | null;
  readonly harnessDirectory: RelativePath;
  readonly orchestratorSkill: RelativePath;
  readonly firstRun: FirstRunGuidance;
  readonly cliFirst: CliFirstGuidance | null;
  readonly editorTerminalApp: string | null;
  readonly hostShell: HostShell | null;
  readonly newChatStep: NewChatStep | null;
  readonly hookActivation: HookActivation | null;
  readonly agentFinishRecorded: HostShell | null;
  readonly statusLine: StatusLineSetting | null;
  readonly directiveMaxBytes: number | null;
  readonly questionOptions: number | null;
};
