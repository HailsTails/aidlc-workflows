import { accepted, refused, type Result } from "../../kernel/result.ts";
import { sourcePath, type KernelRefusal } from "../../kernel/values.ts";
import { hostSourcesQuery, sameHostSourcesQuery, type HostSourcesQuery } from "../domain/host-sources-query.ts";
import type { NeutralSurface, SessionSkill, SharedRuntime, MemoryCompanion } from "../domain/neutral-surface.ts";
import type { ProjectionRefusal } from "../domain/projection.ts";
import { requiredHostSources } from "./host-source-files.ts";
import type { BuildCore, BuildSourceCapture, BuildSourceCaptureRequest, CaptureBuildSources,
  CapturedHostSources } from "./ports/build-sources.ts";

type HostCapture = Promise<Result<CapturedHostSources, readonly (KernelRefusal | ProjectionRefusal)[]>>;
type SessionReading = () => Promise<Result<readonly SessionSkill[], readonly ProjectionRefusal[]>>;
type CoreNeutralCapture = (core: BuildCore) => Promise<Result<NeutralSurface, readonly ProjectionRefusal[]>>;

const hostReading = (request: BuildSourceCaptureRequest): BuildSourceCapture["readHostSources"] => {
  const captures: { readonly query: HostSourcesQuery; readonly captured: HostCapture }[] = [];
  const read = (query: HostSourcesQuery): HostCapture => {
    const existing = captures.find((entry) => sameHostSourcesQuery(entry.query, query));
    if (existing) return existing.captured;
    const captured: HostCapture = request.projection.readHostSources({ root: query.root, host: query.host,
      sources: query.sources, required: query.required })
      .then((files) => files.ok ? accepted({ host: query.host, files: files.value }) : files);
    captures.push({ query, captured });
    return captured;
  };
  return (input): HostCapture => {
    const members = request.hosts.find((candidate) => candidate.host.distribution === input.name);
    const query = hostSourcesQuery(input, members ? requiredHostSources(members.projection) : []);
    return query.ok ? read(query.value) : Promise.resolve(query);
  };
};

const sessionReading = (request: BuildSourceCaptureRequest): SessionReading => {
  let captured: ReturnType<SessionReading> | undefined;
  return () => {
    const source = sourcePath("skills");
    return source.ok ? captured ??= request.projection.readSessionSkills({ source: source.value,
      folder: new URL("skills/", request.core) }) : Promise.resolve(refused([{
        kind: "render-failed", concept: "session-skill", name: "skills", reason: "The session source path is invalid.",
      }]));
  };
};

const neutralReading = (request: BuildSourceCaptureRequest): CoreNeutralCapture => {
  let captured: ReturnType<CoreNeutralCapture> | undefined;
  return (core) => captured ??= request.projection.readNeutral({ core: request.core, sources: core.sources,
    hookGuidance: request.hookGuidance });
};

const fullHostCapture = (ports: {
  readonly request: BuildSourceCaptureRequest;
  readonly readSessions: SessionReading;
  readonly readNeutral: CoreNeutralCapture;
}): BuildSourceCapture["captureFullHost"] => {
  let runtime: Promise<Result<SharedRuntime, readonly ProjectionRefusal[]>> | undefined;
  let companions: Promise<Result<readonly MemoryCompanion[], readonly ProjectionRefusal[]>> | undefined;
  return async (core) => {
    const neutral = await ports.readNeutral(core);
    if (!neutral.ok) return neutral;
    const sessions = await ports.readSessions();
    if (!sessions.ok) return sessions;
    const captured = await (runtime ??= ports.request.projection.readRuntime({ core: ports.request.core,
      method: core.method }));
    if (!captured.ok) return captured;
    const memory = await (companions ??= ports.request.projection.readMemoryCompanions({ core: ports.request.core }));
    return memory.ok ? accepted({ surface: { ...neutral.value, skills: sessions.value },
      runtime: captured.value, companions: memory.value }) : memory;
  };
};

export const captureBuildSources: CaptureBuildSources = (request) => ({
  readHostSources: hostReading(request),
  captureFullHost: fullHostCapture({ request, readSessions: sessionReading(request),
    readNeutral: neutralReading(request) }),
});
