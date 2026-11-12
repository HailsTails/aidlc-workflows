import type { DistributionChannel } from "./projected-file.ts";
import type { FileContent } from "../../kernel/file-content.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import { sourcePath, type KernelRefusal, type SourcePath } from "../../kernel/values.ts";
import type { DocumentExtractorSpec, HookActivation } from "../../../core/tools/aidlc-lib.ts";
import type { KiroLayout } from "../../../core/tools/aidlc-runtime-paths.ts";

export type { DocumentExtractorSpec, HookActivation, KiroLayout };

export type AuthoredHostFile = {
  readonly source: SourcePath;
  readonly content: FileContent;
};

export type StatusLine =
  | { readonly type: "command"; readonly command: string }
  | { readonly items: readonly string[] };

export type NewChatStep = {
  readonly text: string;
  readonly inHost?: { readonly env: readonly string[]; readonly text: string };
};

export type HostData = {
  readonly productName: string;
  readonly configNextStep: string;
  readonly rulesFolder: string | null;
  readonly runnerFrontmatterAdditions?: readonly string[];
  readonly documentExtractors?: Readonly<Record<string, DocumentExtractorSpec>>;
  readonly hookActivation?: HookActivation;
  readonly newChatStep?: NewChatStep;
  readonly kiroLayout?: KiroLayout;
  readonly runtimeKeys?: Readonly<Record<string, string>>;
  readonly directiveMaxBytes?: number;
  readonly statusLine?: StatusLine;
  readonly agentFinishRecorded?: { readonly env: readonly string[] };
  readonly hostShell?: { readonly env: readonly string[] };
  readonly pluginAgentFrontmatter?: Readonly<Record<DistributionChannel, readonly string[]>>;
};

export type AuthoredPlacement = {
  readonly source: string;
  readonly destination: string;
};

export const authoredSourcePaths = (raws: readonly string[]): Result<readonly SourcePath[], KernelRefusal> => {
  const paths = raws.map(sourcePath);
  const failed = paths.find((path) => !path.ok);
  return failed && !failed.ok
    ? refused(failed.refusal)
    : accepted(paths.flatMap((path) => (path.ok ? [path.value] : [])));
};
