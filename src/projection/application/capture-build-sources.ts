import { asFolder } from "../../kernel/file-system-port.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import { distributionId, projectPath, sourcePath, type KernelRefusal } from "../../kernel/values.ts";
import type { NeutralSurface, SessionSkill, SharedRuntime, MemoryCompanion } from "../domain/neutral-surface.ts";
import type { ProjectionRefusal } from "../domain/projection.ts";
import { requiredHostSources } from "./host-source-files.ts";
import type { BuildCore, BuildSourceCapture, BuildSourceCaptureRequest, CaptureBuildSources,
  CapturedHostSources, HostSourcesRequest } from "./ports/build-sources.ts";

type HostCapture = Promise<Result<CapturedHostSources, readonly (KernelRefusal | ProjectionRefusal)[]>>;
type SessionReading = () => Promise<Result<readonly SessionSkill[], readonly ProjectionRefusal[]>>;
type CoreNeutralCapture = (core: BuildCore) => Promise<Result<NeutralSurface, readonly ProjectionRefusal[]>>;

const hostReading = (request: BuildSourceCaptureRequest): BuildSourceCapture["readHostSources"] => {
  const captures = new Map<string, HostCapture>();
  return (capture: HostSourcesRequest): HostCapture => {
    const distribution = distributionId(capture.name);
    if (!distribution.ok) return Promise.resolve(refused([distribution.refusal]));
    const directory = projectPath(capture.directory);
    if (!directory.ok) return Promise.resolve(refused([directory.refusal]));
    const host = { distribution: distribution.value, directory: directory.value };
    const members = request.hosts.find((candidate) => candidate.host.distribution === host.distribution);
    const required = [...capture.required, ...(members ? requiredHostSources(members.projection) : [])];
    const paths = [...new Set([...capture.copied, ...required])].map(sourcePath);
    const failures = paths.flatMap((path) => path.ok ? [] : [path.refusal]);
    if (failures.length > 0) return Promise.resolve(refused(failures));
    const sources = paths.flatMap((path) => path.ok ? [path.value] : []);
    const mandatory = sources.filter((path) => required.includes(path));
    const key = JSON.stringify([host.distribution, host.directory, asFolder(capture.root).href, sources, mandatory]);
    const existing = captures.get(key);
    if (existing) return existing;
    const captured: HostCapture = request.projection.readHostSources({ root: capture.root, host, sources,
      required: mandatory }).then((files) => files.ok ? accepted({ host, files: files.value }) : files);
    captures.set(key, captured);
    return captured;
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
  return (core) => captured ??= request.projection.readNeutral({ core: request.core, sources: core.sources });
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
