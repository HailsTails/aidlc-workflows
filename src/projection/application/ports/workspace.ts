import type { HostIdentity } from "../../../kernel/host.ts";
import type { Result } from "../../../kernel/result.ts";
import type { MethodSource } from "../../../workflow-definition/domain/method-source.ts";
import type { MemoryCompanion } from "../../domain/neutral-surface.ts";
import type { ProjectionRefusal } from "../../domain/projection.ts";
import type { TokenBindings } from "../../domain/template-token.ts";
import type { Rendering } from "./harness.ts";

export type WorkspaceProjectionRequest = {
  readonly host: HostIdentity;
  readonly rules: readonly MethodSource[];
  readonly companions: readonly MemoryCompanion[];
  readonly tokens: TokenBindings;
};

export type WorkspaceProjection = (request: WorkspaceProjectionRequest) => Rendering;

export type MemoryCompanionReading = (capture: {
  readonly core: URL;
}) => Promise<Result<readonly MemoryCompanion[], readonly ProjectionRefusal[]>>;
