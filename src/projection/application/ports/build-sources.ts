import type { HostIdentity } from "../../../kernel/host.ts";
import type { Result } from "../../../kernel/result.ts";
import type { KernelRefusal } from "../../../kernel/values.ts";
import type { AuthoredHostFile } from "../../domain/host-surface.ts";
import type { MemoryCompanion, NeutralSurface, SharedRuntime } from "../../domain/neutral-surface.ts";
import type { ProjectionRefusal } from "../../domain/projection.ts";
import type { BuildProjection } from "./build-projection.ts";
import type { HostProjectionParts } from "./host-parts.ts";

export type HostSourcesRequest = {
  readonly name: string;
  readonly directory: string;
  readonly root: URL;
  readonly copied: readonly string[];
  readonly required: readonly string[];
};

export type CapturedHostSources = {
  readonly host: HostIdentity;
  readonly files: readonly AuthoredHostFile[];
};

export type HostSourceParts = {
  readonly [Concept in "agents" | "skills" | "settings" | "documents"]: Pick<HostProjectionParts[Concept], "inputs">;
} & Pick<HostProjectionParts, "placements">;

export type HostSourceMember = {
  readonly host: HostIdentity;
  readonly projection: HostSourceParts;
};

export type FullHostCapture = {
  readonly surface: NeutralSurface;
  readonly runtime: SharedRuntime;
  readonly companions: readonly MemoryCompanion[];
};

export type BuildCore = {
  readonly method: Parameters<BuildProjection["readRuntime"]>[0]["method"];
  readonly sources: Parameters<BuildProjection["readNeutral"]>[0]["sources"];
};

export type BuildSourceCapture = {
  readHostSources(
    request: HostSourcesRequest,
  ): Promise<Result<CapturedHostSources, readonly (KernelRefusal | ProjectionRefusal)[]>>;
  captureFullHost(core: BuildCore): Promise<Result<FullHostCapture, readonly ProjectionRefusal[]>>;
};

export type BuildSourceCaptureRequest = {
  readonly projection: Pick<
    BuildProjection,
    "readHostSources" | "readSessionSkills" | "readNeutral" | "readRuntime" | "readMemoryCompanions"
  >;
  readonly core: URL;
  readonly hosts: readonly HostSourceMember[];
};

export type CaptureBuildSources = (request: BuildSourceCaptureRequest) => BuildSourceCapture;
