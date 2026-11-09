import type { HostIdentity } from "../../../kernel/host.ts";
import type { MethodSource } from "../../../workflow-definition/domain/method-source.ts";
import type { TokenBindings } from "../../domain/template-token.ts";
import type { Rendering } from "./harness.ts";

export type WorkspaceProjectionRequest = {
  readonly host: HostIdentity;
  readonly rules: readonly MethodSource[];
  readonly tokens: TokenBindings;
};

export type WorkspaceProjection = (request: WorkspaceProjectionRequest) => Rendering;
