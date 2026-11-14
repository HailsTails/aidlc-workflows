import { z } from "zod";
import type { FileContent } from "../../kernel/file-content.ts";
import { asFolder, type FileSystem } from "../../kernel/file-system-port.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { DistributionId } from "../../kernel/values.ts";
import type { ContentHasher, PackagedSources } from "../application/ports.ts";
import type { PackagingRefusal } from "../domain/artifact.ts";

type InputFile = { readonly path: string; readonly content: FileContent };
type InputReading = Result<readonly InputFile[], PackagingRefusal>;
type SourceRecord = { readonly presence: "absent" | "present"; readonly hosts: Readonly<Record<string, string>> };
type SourcesBinding = {
  readonly repository: URL;
  readonly record: URL;
  readonly fileSystem: FileSystem;
  readonly hasher: ContentHasher;
};

const INPUT_DIRS = ["core", "harness", "plugins", "src", "scripts/plugin-hooks-template"];
const INPUT_FILES = ["scripts/package.ts", "scripts/package-sources.ts", "scripts/agent-knowledge.ts",
  "scripts/copy-era-files.json"];
const IGNORED_INPUT_PATHS = [/(?:^|\/)node_modules(?:\/|$)/, /^plugins\/[^/]+\/tests(?:\/|$)/,
  /^src\/.*\/(?:fixtures|tests)(?:\/|$)/, /^src\/.*\.(test|spec)\.ts$/];
const sourceRecordSchema = z.object({ harnesses: z.record(z.string(), z.unknown()) });
const byPath = (first: string, second: string): number => first < second ? -1 : Number(first > second);
const bytesOf = (content: FileContent): Uint8Array =>
  content.kind === "bytes" ? content.bytes : new TextEncoder().encode(content.text);
const under = (repository: URL, path: string): URL =>
  new URL(path.split("/").map(encodeURIComponent).join("/"), asFolder(repository));

const readInputTree = async (binding: SourcesBinding, directory: string): Promise<InputReading> => {
  const folder = new URL(`${directory}/`, asFolder(binding.repository));
  const reading = await binding.fileSystem.readTree({ folder, select: (entry) =>
    entry.kind === "other" || IGNORED_INPUT_PATHS.some((pattern) => pattern.test(`${directory}/${entry.within}`))
      ? "skip" : "read" });
  if (!reading.ok) return reading.refusal.code === "not-found" ? accepted([])
    : refused({ kind: "packaged-sources-failed", operation: "read-inputs", path: folder.href,
      reason: reading.refusal.code });
  const unreadable = reading.value.unreadable[0];
  return unreadable ? refused({ kind: "packaged-sources-failed", operation: "read-inputs",
    path: `${directory}/${unreadable.within}`, reason: unreadable.code })
    : accepted(reading.value.files.map((file) => ({ path: `${directory}/${file.path}`, content: file.content })));
};

const readInputFile = async (binding: SourcesBinding, path: string): Promise<InputReading> => {
  const reading = await binding.fileSystem.readFile({ file: under(binding.repository, path) });
  return reading.ok ? accepted([{ path, content: reading.value }])
    : reading.refusal.code === "not-found" ? accepted([])
    : refused({ kind: "packaged-sources-failed", operation: "read-inputs", path, reason: reading.refusal.code });
};

const framedInputs = (files: readonly InputFile[]): FileContent => {
  const encoder = new TextEncoder();
  const chunks = files.toSorted((first, second) => byPath(first.path, second.path))
    .flatMap((file) => [encoder.encode(file.path), new Uint8Array([0]), bytesOf(file.content), new Uint8Array([0])]);
  const stream = new Uint8Array(chunks.reduce((length, chunk) => length + chunk.length, 0));
  chunks.reduce((offset, chunk) => { stream.set(chunk, offset); return offset + chunk.length; }, 0);
  return { kind: "bytes", bytes: stream };
};

const fingerprint = async (binding: SourcesBinding): Promise<Result<string, PackagingRefusal>> => {
  const readings = await Promise.all([...INPUT_DIRS.map((directory) => readInputTree(binding, directory)),
    ...INPUT_FILES.map((path) => readInputFile(binding, path))]);
  const failure = readings.find((reading) => !reading.ok);
  if (failure && !failure.ok) return failure;
  const digest = binding.hasher.hash(framedInputs(readings.flatMap((reading) => reading.ok ? reading.value : [])));
  return digest.ok ? accepted(digest.value.slice("sha256:".length))
    : refused({ kind: "packaged-sources-failed", operation: "hash-inputs", path: binding.repository.href,
      reason: digest.refusal.kind });
};

const decodedRecord = (content: FileContent): Readonly<Record<string, string>> => {
  try {
    const record = sourceRecordSchema.safeParse(JSON.parse(new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytesOf(content))));
    return record.success ? Object.fromEntries(Object.entries(record.data.harnesses)
      .flatMap(([host, fingerprint]) => typeof fingerprint === "string" ? [[host, fingerprint]] : [])) : {};
  } catch { return {}; }
};

const readRecord = async (binding: SourcesBinding): Promise<SourceRecord> => {
  const reading = await binding.fileSystem.readFile({ file: binding.record });
  return reading.ok ? { presence: "present", hosts: decodedRecord(reading.value) }
    : { presence: reading.refusal.code === "not-found" ? "absent" : "present", hosts: {} };
};

const writeRecord = async (binding: SourcesBinding, hosts: Readonly<Record<string, string>>)
: Promise<Result<void, PackagingRefusal>> => {
  const sorted = Object.fromEntries(Object.entries(hosts).toSorted(([first], [second]) => byPath(first, second)));
  const written = await binding.fileSystem.writeFile({ file: binding.record,
    content: { kind: "text", text: `${JSON.stringify({ schemaVersion: 1, harnesses: sorted }, null, 2)}\n` } });
  return written.ok ? accepted(undefined)
    : refused({ kind: "packaged-sources-failed", operation: "write-record", path: binding.record.href,
      reason: written.refusal.code });
};

const forget = async (binding: SourcesBinding, hosts: readonly DistributionId[])
: Promise<Result<void, PackagingRefusal>> => {
  const current = await readRecord(binding);
  return current.presence === "absent" ? accepted(undefined)
    : writeRecord(binding, Object.fromEntries(Object.entries(current.hosts)
      .filter(([host]) => !hosts.some((distribution) => distribution === host))));
};

const record = async (binding: SourcesBinding, request: {
  readonly hosts: readonly DistributionId[]; readonly builtFrom: string;
}): Promise<Result<"recorded" | "inputs-changed", PackagingRefusal>> => {
  const current = await fingerprint(binding);
  if (!current.ok) return current;
  if (current.value !== request.builtFrom) return accepted("inputs-changed");
  const prior = await readRecord(binding);
  const written = await writeRecord(binding, { ...prior.hosts,
    ...Object.fromEntries(request.hosts.map((host) => [host, request.builtFrom])) });
  return written.ok ? accepted("recorded") : written;
};

const staleness = async (binding: SourcesBinding, host: DistributionId)
: Promise<Result<string | null, PackagingRefusal>> => {
  const prior = await readRecord(binding);
  const current = await fingerprint(binding);
  if (!current.ok) return current;
  const recorded = prior.hosts[host];
  return accepted(recorded === current.value ? null : recorded === undefined
    ? `dist/${host} has no record of the sources it was packaged from: run \`bun scripts/package.ts\` first.`
    : `dist/${host} was packaged from other sources than this checkout: run \`bun scripts/package.ts\` first.`);
};

export const createPackagedSourcesFile = (binding: SourcesBinding): PackagedSources => ({
  fingerprint: () => fingerprint(binding),
  forget: (hosts) => forget(binding, hosts),
  record: (request) => record(binding, request),
  staleness: (host) => staleness(binding, host),
});
