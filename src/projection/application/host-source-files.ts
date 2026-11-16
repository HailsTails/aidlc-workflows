import { asFolder } from "../../kernel/file-system-port.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { SourcePath } from "../../kernel/values.ts";
import type { HostFileReader, HostSourceCapture, HostSurfaceReader } from "./ports/host-sources.ts";
import type { AuthoredHostFile } from "../domain/host-surface.ts";
import type { ProjectionRefusal } from "../domain/projection.ts";
import type { HostSourceParts } from "./ports/build-sources.ts";

export const requiredHostSources = (projection: HostSourceParts): readonly string[] => [
  ...projection.agents.inputs, ...projection.skills.inputs, ...projection.settings.inputs,
  ...projection.documents.inputs, ...projection.placements.map((placement) => placement.source),
];

type HostFiles = Result<readonly AuthoredHostFile[], readonly ProjectionRefusal[]>;
type HostSourceOptions = HostSourceCapture & { readonly reader: HostFileReader };

const captureFile = async (options: HostSourceOptions, source: SourcePath):
  Promise<Result<AuthoredHostFile | null, ProjectionRefusal>> => {
  const file = new URL(source.split("/").map(encodeURIComponent).join("/"), asFolder(options.root));
  const reading = await options.reader.readFile({ file });
  if (!reading.ok) {
    return !options.required.includes(source) && reading.refusal.code === "not-found" ? accepted(null)
      : refused({ kind: "host-source-unreadable", host: options.host, source,
        reason: `Host source is unreadable: ${reading.refusal.code}.` });
  }
  const bytes = reading.value.kind === "text" ? new TextEncoder().encode(reading.value.text)
    : new Uint8Array(reading.value.bytes);
  return accepted({ source, content: { kind: "bytes", bytes } });
};

const captureFiles = async (options: HostSourceOptions): Promise<HostFiles> => {
  const readings = await Promise.all([...new Set(options.sources)].map((source) => captureFile(options, source)));
  const failures = readings.flatMap((reading) => reading.ok ? [] : [reading.refusal]);
  return failures.length > 0 ? refused(failures) : accepted(readings.flatMap((reading) =>
    reading.ok && reading.value !== null ? [reading.value] : []));
};

export const createHostSurfaceReader = (options: HostSourceOptions): HostSurfaceReader => {
  const captures = new Map<string, Promise<HostFiles>>();
  return { read: ({ host }) => {
    if (host.distribution !== options.host.distribution || host.directory !== options.host.directory) {
      return Promise.resolve(refused([{ kind: "unknown-harness", harness: host.distribution }]));
    }
    const existing = captures.get(host.distribution);
    if (existing) return existing;
    const captured = captureFiles(options);
    captures.set(host.distribution, captured);
    return captured;
  } };
};
