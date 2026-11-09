import type { HostIdentity } from "../../../kernel/host.ts";
import type { Result } from "../../../kernel/result.ts";
import type { SourcePath } from "../../../kernel/values.ts";
import type { Method } from "../../../workflow-definition/domain/method.ts";
import type { Tier } from "../../../workflow-definition/domain/vocabulary.ts";
import type { AuthoredHostFile } from "../../domain/host-surface.ts";
import type { DistributionChannel } from "../../domain/projected-file.ts";
import type { ProjectionRefusal } from "../../domain/projection.ts";
import type { TokenBindings } from "../../domain/template-token.ts";
import type { CopyChannelAllows } from "./copy-channel.ts";
import type { Harness, Rendering } from "./harness.ts";
import type { AuthoredFilePreparer } from "./host-sources.ts";

export type HookTrustIdentity = {
  readonly event: string;
  readonly command: string;
  readonly timeoutSeconds: number;
  readonly matcher: string | undefined;
};

export type HookTrustHash = (identity: HookTrustIdentity) => string;

export type CliModelPolicy = (file: AuthoredHostFile) => Result<AuthoredHostFile, ProjectionRefusal>;

export type SettingsRenderingInputs = {
  readonly extendedSubprocessTimeoutMs: number;
  readonly hookTrust: HookTrustHash;
  readonly cliModels: CliModelPolicy;
  readonly files: readonly AuthoredHostFile[];
  readonly prepare: AuthoredFilePreparer;
  readonly tokens: TokenBindings;
  readonly allows: CopyChannelAllows;
  readonly channel: DistributionChannel;
  readonly entrypoints: readonly SourcePath[];
};

export type HostSettingsRenderer = (
  inputs: SettingsRenderingInputs,
) => Pick<Harness, "renderSettings" | "renderHookRegistrations">;

export type SettingsProjectionRequest = {
  readonly modelCap: Tier | null;
  readonly method: Method;
  readonly host: HostIdentity;
  readonly render: HostSettingsRenderer;
  readonly files: readonly AuthoredHostFile[];
  readonly prepare: AuthoredFilePreparer;
  readonly tokens: TokenBindings;
  readonly channel: DistributionChannel;
  readonly entrypoints: readonly SourcePath[];
};

export type SettingsProjection = (request: SettingsProjectionRequest) => Rendering;
