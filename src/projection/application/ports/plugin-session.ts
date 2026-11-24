import type { HostIdentity } from "../../../kernel/host.ts";
import type { Result } from "../../../kernel/result.ts";
import type { KernelRefusal } from "../../../kernel/values.ts";
import type { AuthoredCoreMethod, AuthoredPluginBuild, PluginBuildTarget }
  from "../../../workflow-definition/domain/authored-method.ts";
import type { MethodRefusal } from "../../../workflow-definition/domain/refusals.ts";
import type { HostPluginTarget } from "../../domain/host-surface.ts";
import type { ProjectionRefusal } from "../../domain/projection.ts";
import type { PluginProjector } from "./plugins.ts";

export type PluginEmission = {
  readonly plugin: PluginBuildTarget; readonly host: HostIdentity;
  readonly output: URL; readonly boundary: URL;
};

export type PluginBuildView = {
  emit(request: PluginEmission): Result<URL, readonly (KernelRefusal | ProjectionRefusal)[]>;
  catalogues(request: { readonly output: URL; readonly hosts: readonly HostIdentity[] }):
    Result<readonly string[], readonly (KernelRefusal | ProjectionRefusal)[]>;
};

export type PluginBuildSession = {
  load(request: { readonly core: AuthoredCoreMethod }): Promise<Result<AuthoredPluginBuild, readonly MethodRefusal[]>>;
  forBuild(): Result<PluginBuildView, readonly ProjectionRefusal[]>;
  project(request: PluginEmission & { readonly reviewerAgents: ReadonlySet<string> }):
    Result<URL, readonly (KernelRefusal | ProjectionRefusal)[]>;
};

export type PluginSessionPorts = {
  readonly loadMethod: PluginBuildSession["load"];
  readonly projector: PluginProjector;
  readonly sources: URL;
  readonly readTarget: (request: { readonly host: HostIdentity }) =>
    Result<HostPluginTarget, readonly (KernelRefusal | ProjectionRefusal)[]>;
};
