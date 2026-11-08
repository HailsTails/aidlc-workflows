import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { HostIdentity } from "../../kernel/host.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { SourcePath } from "../../kernel/values.ts";
import type { HostSurfaceReader } from "../application/ports.ts";
import type { AuthoredHostFile } from "../domain/host-surface.ts";
import type { ProjectionRefusal } from "../domain/projection.ts";

type HostFiles = Result<readonly AuthoredHostFile[], readonly ProjectionRefusal[]>;
type HostSourceOptions = {
  readonly root: string;
  readonly host: HostIdentity;
  readonly sources: readonly SourcePath[];
  readonly required: readonly SourcePath[];
  readonly read?: (path: string) => Promise<Uint8Array>;
};

const captureFile = async (options: HostSourceOptions, source: SourcePath):
  Promise<Result<AuthoredHostFile | null, ProjectionRefusal>> => {
  try {
    const bytes = await (options.read ?? readFile)(join(options.root, source));
    return accepted({ source, content: { kind: "bytes", bytes: new Uint8Array(bytes) } });
  } catch (error) {
    if (!options.required.includes(source) && typeof error === "object" && error !== null
      && "code" in error && error.code === "ENOENT") return accepted(null);
    return refused({ kind: "host-source-unreadable", host: options.host, source,
      reason: error instanceof Error ? error.message : String(error) });
  }
};

const captureFiles = async (options: HostSourceOptions): Promise<HostFiles> => {
  const readings = await Promise.all([...new Set(options.sources)].map((source) =>
    captureFile(options, source)));
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
