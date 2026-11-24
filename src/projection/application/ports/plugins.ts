import type { HostIdentity } from "../../../kernel/host.ts";
import type { Result } from "../../../kernel/result.ts";
import type { PluginId } from "../../../workflow-definition/domain/identities.ts";
import type { HostPluginTarget } from "../../domain/host-surface.ts";
import type { ProjectionRefusal } from "../../domain/projection.ts";

export type PluginProjectionRequest = {
  readonly plugin: PluginId;
  readonly pluginFolder: URL;
  readonly host: HostIdentity;
  readonly target: HostPluginTarget;
  readonly output: URL;
  readonly boundary: URL;
  readonly reviewerAgents: ReadonlySet<string>;
};

export type HostedPluginTarget = {
  readonly host: HostIdentity;
  readonly target: HostPluginTarget;
};

export type PluginCatalogueRequest = {
  readonly output: URL;
  readonly targets: readonly HostedPluginTarget[];
};

export interface PluginProjector {
  project(request: PluginProjectionRequest): Result<URL, ProjectionRefusal>;
  writeCatalogues(request: PluginCatalogueRequest): Result<readonly string[], ProjectionRefusal>;
}
