import { z } from "zod";
import type { FileContent } from "../../kernel/file-content.ts";
import type { FileSystem } from "../../kernel/file-system-port.ts";
import { contentHash, projectPath, type DistributionId, type ContentHash, type ProjectPath } from "../../kernel/values.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { ReleaseHistorySource } from "../application/ports.ts";
import type { ReleaseHistory, RetiredFile } from "../domain/release-history.ts";

const historySchema = z.record(z.string(), z.record(z.string(), z.array(z.string())));
type HistoryMap = z.infer<typeof historySchema>;
type CapturedHistory = Promise<Result<HistoryMap, string>>;

const decodeHistory = (content: FileContent): Result<HistoryMap, string> => {
  const text = content.kind === "text" ? content.text
    : new TextDecoder("utf-8", { ignoreBOM: true }).decode(content.bytes);
  try {
    const decoded = historySchema.safeParse(JSON.parse(text));
    return decoded.success ? accepted(decoded.data) : refused("Copy-era history is not a distribution-to-file hash map.");
  } catch {
    return refused("Copy-era history is not valid JSON.");
  }
};

const captureHistory = async ({ reader, source }: {
  readonly reader: Pick<FileSystem, "readFile">; readonly source: URL;
}): CapturedHistory => {
  const content = await reader.readFile({ file: source });
  return content.ok ? decodeHistory(content.value) : refused(`Copy-era history is unreadable: ${content.refusal.code}.`);
};

const historyFile = ([rawPath, rawHashes]: readonly [string, readonly string[]]): Result<RetiredFile, string> => {
  const path = projectPath(rawPath);
  if (!path.ok) return refused(`Copy-era history has an invalid path: ${rawPath}.`);
  const hashes = rawHashes.map(contentHash);
  const bad = hashes.find((hash) => !hash.ok);
  return bad && !bad.ok ? refused(`Copy-era history has an invalid content hash at ${rawPath}.`)
    : accepted({ path: path.value, shippedHashes: hashes.flatMap((hash) => hash.ok ? [hash.value] : []) });
};

const historyFiles = (captured: HistoryMap, distribution: DistributionId): Result<readonly RetiredFile[], string> =>
  Object.entries(captured[distribution] ?? {}).reduce<Result<readonly RetiredFile[], string>>((files, entry) => {
    if (!files.ok) return files;
    const file = historyFile(entry);
    return file.ok ? accepted([...files.value, file.value]) : file;
  }, accepted([]));

const mergeHistory = (previous: ReleaseHistory, added: readonly RetiredFile[]): ReleaseHistory => {
  const files = [...previous.retiredFiles, ...added].reduce<ReadonlyMap<ProjectPath, readonly ContentHash[]>>(
    (history, file) => new Map([...history, [file.path,
      [...new Set([...(history.get(file.path) ?? []), ...file.shippedHashes])].sort()]]), new Map(),
  );
  return { priorIntegrations: previous.priorIntegrations,
    retiredFiles: Array.from(files, ([path, shippedHashes]) => ({ path, shippedHashes })) };
};

export const createCopyEraHistory = (request: {
  readonly reader: Pick<FileSystem, "readFile">;
  readonly source: URL;
  readonly prior: ReleaseHistorySource;
}): ReleaseHistorySource => {
  let captured: CapturedHistory | undefined;
  return { history: async (distribution) => {
    const prior = await request.prior.history(distribution);
    if (!prior.ok) return prior;
    const capture = await (captured ??= captureHistory(request));
    if (!capture.ok) return refused({ kind: "release-history-unreadable", distribution, reason: capture.refusal });
    const files = historyFiles(capture.value, distribution);
    return files.ok ? accepted(mergeHistory(prior.value, files.value))
      : refused({ kind: "release-history-unreadable", distribution, reason: files.refusal });
  } };
};
