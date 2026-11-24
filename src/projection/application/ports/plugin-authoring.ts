import type { FileSystem } from "../../../kernel/file-system-port.ts";
import type { HostIdentity } from "../../../kernel/host.ts";
import type { Result } from "../../../kernel/result.ts";
import type { KernelRefusal, ProjectPath } from "../../../kernel/values.ts";
import type { Method } from "../../../workflow-definition/domain/method.ts";
import type { HostPluginTarget } from "../../domain/host-surface.ts";
import type { HostProjection, ProjectionRefusal } from "../../domain/projection.ts";

export type EnrichPluginAuthoring = (request: {
  readonly legacyNative?: import("../../domain/legacy-native-source.ts").LegacyNativeContext | undefined;
  readonly projection: HostProjection; readonly method: Method; readonly directory: ProjectPath;
}) => Promise<Result<HostProjection, readonly (KernelRefusal | ProjectionRefusal)[]>>;

export type PluginAuthoringCapture = {
  readonly templates: { readonly folder: URL; readonly reader: Pick<FileSystem, "readTree"> };
  readonly targets: readonly { readonly host: HostIdentity;
    readonly read: () => Result<HostPluginTarget, readonly (KernelRefusal | ProjectionRefusal)[]> }[];
};
