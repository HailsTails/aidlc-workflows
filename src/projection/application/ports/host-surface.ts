import type { HostIdentity } from "../../../kernel/host.ts";
import type { AuthoredHostFile, AuthoredPlacement, HostData } from "../../domain/host-surface.ts";
import type { DistributionChannel } from "../../domain/projected-file.ts";
import type { TokenBindings } from "../../domain/template-token.ts";
import type { DelegateShellPolicy } from "./delegate-shell.ts";
import type { Rendering } from "./harness.ts";
import type { AuthoredFilePreparer } from "./host-sources.ts";

export type HostDataInputs = {
  readonly delegateShell: DelegateShellPolicy;
};

export type HostDataRenderer = (inputs: HostDataInputs) => HostData;

export type HostSurfaceProjectionRequest = {
  readonly host: HostIdentity;
  readonly renderData: HostDataRenderer;
  readonly placements: readonly AuthoredPlacement[];
  readonly files: readonly AuthoredHostFile[];
  readonly prepare: AuthoredFilePreparer;
  readonly tokens: TokenBindings;
  readonly channel: DistributionChannel;
};

export type HostSurfaceProjection = (request: HostSurfaceProjectionRequest) => Rendering;
