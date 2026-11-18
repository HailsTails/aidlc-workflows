import type { HostIdentity } from "../../../kernel/host.ts";
import type { Result } from "../../../kernel/result.ts";
import type { KernelRefusal } from "../../../kernel/values.ts";
import type { CompiledMethodFiles, HostProjection, ProjectionRefusal } from "../../domain/projection.ts";
import type { BuildCore, BuildSourceCapture } from "./build-sources.ts";
import type { HarnessAssembly, HarnessAssemblyRequest } from "./harness-assembly.ts";
import type { HostProjectionParts } from "./host-parts.ts";
import type { HostedHarness } from "./harness.ts";
import type { ProjectMethodForHarness } from "./method-projection.ts";
import type { OnboardingContext } from "../../domain/onboarding-context.ts";
import type { NativeCommandRoutes } from "../../domain/native-command.ts";
import type { LegacyNativeReplacement } from "../../domain/legacy-native-source.ts";

export type CompiledMethodTarget = {
  readonly name: string; readonly directory: string; readonly memoryRoot: string;
};

export type CapturedMethodCompiler = (target: CompiledMethodTarget) => Result<CompiledMethodFiles, KernelRefusal>;

export type HostProjectionMember = { readonly host: HostIdentity; readonly projection: HostProjectionParts };

export type CapturedHostProjectionRequest = Pick<HarnessAssemblyRequest,
  "host" | "files" | "prepare" | "tokens" | "modelCap" | "entrypoints" | "projectRoot" | "reviewerAgents"> & {
  readonly onboarding: OnboardingContext;
  readonly nativeReplacements: readonly LegacyNativeReplacement[];
  readonly core: BuildCore;
  readonly compile: CapturedMethodCompiler;
};

export type ProjectCapturedHost = (request: CapturedHostProjectionRequest) =>
  Promise<Result<HostProjection, readonly (KernelRefusal | ProjectionRefusal)[]>>;

export type CapturedHostProjectionPorts = {
  readonly nativeCommands: NativeCommandRoutes;
  readonly members: readonly HostProjectionMember[];
  readonly capture: BuildSourceCapture["captureFullHost"];
  readonly assemble: HarnessAssembly;
  readonly hosted: (hosted: HostedHarness) => ProjectMethodForHarness;
};
