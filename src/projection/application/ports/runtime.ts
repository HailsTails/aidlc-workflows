import type { FileContent } from "../../../kernel/file-content.ts";
import type { HostIdentity } from "../../../kernel/host.ts";
import type { Result } from "../../../kernel/result.ts";
import type { Method } from "../../../workflow-definition/domain/method.ts";
import type { SharedRuntime } from "../../domain/neutral-surface.ts";
import type { ProjectionRefusal } from "../../domain/projection.ts";
import type { TokenBindings } from "../../domain/template-token.ts";
import type { Rendering } from "./harness.ts";

export type VersionStamp = (module: FileContent) => Result<FileContent, ProjectionRefusal>;

export type RuntimeCapture = {
  readonly core: URL;
  readonly method: Method;
  readonly stamp: VersionStamp;
};

export type RuntimeReading = (
  capture: RuntimeCapture,
) => Promise<Result<SharedRuntime, readonly ProjectionRefusal[]>>;

export type RuntimeProjectionRequest = {
  readonly host: HostIdentity;
  readonly runtime: SharedRuntime;
  readonly tokens: TokenBindings;
};

export type RuntimeProjection = (request: RuntimeProjectionRequest) => Rendering;
