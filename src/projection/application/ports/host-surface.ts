import type { SharedKnowledge } from "../../../workflow-definition/domain/knowledge.ts";
import type { HostIdentity } from "../../../kernel/host.ts";
import type { AuthoredHostFile, AuthoredPlacement, HostData } from "../../domain/host-surface.ts";
import type { DistributionChannel } from "../../domain/projected-file.ts";
import type { TokenBindings } from "../../domain/template-token.ts";
import type { DelegateShellFacts } from "./delegate-shell.ts";
import type { Rendering } from "./harness.ts";
import type { AuthoredFilePreparer } from "./host-sources.ts";
import type { Result } from "../../../kernel/result.ts";
import type { HarnessRecord, HarnessRecordFacts } from "../../domain/harness-record.ts";
import type { ProjectionRefusal } from "../../domain/projection.ts";

export type HarnessRecordConstructor = (facts: HarnessRecordFacts) => Result<HarnessRecord, ProjectionRefusal>;

export type HostDataInputs = {
  readonly sharedKnowledge: SharedKnowledge;
  readonly delegateShellFacts: DelegateShellFacts;
};

export type HostDataRenderer = (inputs: HostDataInputs) => HostData;

export type HostSurfaceProjectionRequest = {
  readonly sharedKnowledge: SharedKnowledge;
  readonly legacyNative?: import("../../domain/legacy-native-source.ts").LegacyNativeContext | undefined;
  readonly host: HostIdentity;
  readonly renderData: HostDataRenderer;
  readonly record: HarnessRecordConstructor;
  readonly placements: readonly AuthoredPlacement[];
  readonly files: readonly AuthoredHostFile[];
  readonly prepare: AuthoredFilePreparer;
  readonly tokens: TokenBindings;
  readonly channel: DistributionChannel;
};

export type HostSurfaceProjection = (request: HostSurfaceProjectionRequest) => Rendering;
