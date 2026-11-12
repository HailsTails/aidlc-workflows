import type { DistributionChannel, ProjectedFile } from "./projected-file.ts";
import type { ProjectionRefusal } from "./projection.ts";
import type { FileContent } from "../../kernel/file-content.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import { sourcePath, type KernelRefusal, type SourcePath } from "../../kernel/values.ts";
import type { DocumentExtractorSpec, HookActivation } from "../../../core/tools/aidlc-lib.ts";

export type { DocumentExtractorSpec, HookActivation };

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

type HarnessRecordLine = {
  readonly key: string;
  readonly value: string;
};

const RECORD_KEYS_BEFORE_A_HOST_LINE = [
  "rulesSubdir", "runnerFrontmatterAdditions", "documentExtractors", "hookActivation", "newChatStep",
] as const;

const parsedRecord = (text: string): readonly (readonly [string, unknown])[] | null => {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? Object.entries(parsed) : null;
  } catch {
    return null;
  }
};

const recordFailure = (path: string, reason: string): Result<never, ProjectionRefusal> =>
  refused({ kind: "render-failed", concept: "host-data", name: path, reason });

export const harnessRecordWithLine = (request: {
  readonly files: readonly ProjectedFile[];
  readonly path: string;
  readonly line: HarnessRecordLine;
}): Result<readonly ProjectedFile[], ProjectionRefusal> => {
  const record = request.files.find((file) => file.path === request.path);
  if (record?.content.kind !== "text") return recordFailure(request.path, "The host's harness record was not projected as text.");
  const entries = parsedRecord(record.content.text);
  if (entries === null) return recordFailure(request.path, "The host's harness record is not a JSON object.");
  const after = entries.findLastIndex(([key]) => RECORD_KEYS_BEFORE_A_HOST_LINE.some((before) => before === key)) + 1;
  const completed = [...entries.slice(0, after), [request.line.key, request.line.value], ...entries.slice(after)];
  return accepted([{ ...record, content: { kind: "text", text: `${JSON.stringify(Object.fromEntries(completed), null, 2)}\n` } }]);
};
