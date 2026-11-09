import type { FileContent } from "../../kernel/file-content.ts";
import type { SourcePath } from "../../kernel/values.ts";

export type AuthoredHostFile = {
  readonly source: SourcePath;
  readonly content: FileContent;
};

export type HostEnvironmentText = {
  readonly env: readonly string[];
  readonly text: string;
};

export type HookRegistrationLines = {
  readonly file: string;
  readonly missing: string;
  readonly invalid: string;
  readonly unwired: string;
};

export type HookActivation = {
  readonly recovery: string;
  readonly missedReply?: string;
  readonly missedReplyInHost?: HostEnvironmentText;
  readonly missesReplies?: true;
  readonly notRunYet?: string;
  readonly notRunYetCliFirst?: HostEnvironmentText;
  readonly notRunInWorkflow?: string;
  readonly agentStep?: string;
  readonly agentStepInHost?: HostEnvironmentText;
  readonly agentStepEdits?: string;
  readonly registration?: HookRegistrationLines;
  readonly startedInsideProject?: string;
};

export type NewChatStep = {
  readonly text: string;
  readonly inHost?: HostEnvironmentText;
};

export type StatusLine =
  | { readonly type: "command"; readonly command: string }
  | { readonly items: readonly string[] };

export type DocumentExtractor = {
  readonly argv: readonly string[];
  readonly timeoutMs?: number;
};

export type KiroLayout = "agent-v1" | "kas";

export type HostData = {
  readonly productName: string;
  readonly configNextStep: string;
  readonly rulesFolder: string | null;
  readonly runnerFrontmatterAdditions?: readonly string[];
  readonly documentExtractors?: Readonly<Record<string, DocumentExtractor>>;
  readonly hookActivation?: HookActivation;
  readonly newChatStep?: NewChatStep;
  readonly kiroLayout?: KiroLayout;
  readonly directiveMaxBytes?: number;
  readonly statusLine?: StatusLine;
  readonly agentFinishRecorded?: { readonly env: readonly string[] };
  readonly hostShell?: { readonly env: readonly string[] };
  readonly pluginAgentFrontmatter?: readonly string[];
};

export type AuthoredPlacement = {
  readonly source: string;
  readonly destination: string;
};
