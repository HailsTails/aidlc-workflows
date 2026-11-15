import type { HostIdentity } from "../../../kernel/host.ts";
import type { Result } from "../../../kernel/result.ts";
import type { Method } from "../../../workflow-definition/domain/method.ts";
import type { MethodSource } from "../../../workflow-definition/domain/method-source.ts";
import type { NeutralSurface, CapturedNeutralSurface, OnboardingFills } from "../../domain/neutral-surface.ts";
import type { ProjectionRefusal } from "../../domain/projection.ts";
import type { TokenBindings } from "../../domain/template-token.ts";
import type { Harness, Rendering } from "./harness.ts";
import type { HookGuidanceSource, ToolsGuidanceSource } from "../../domain/onboarding-source.ts";

export type DocumentRenderingInputs = {
  readonly bindingHeadings: readonly string[];
  readonly fills: OnboardingFills;
  readonly tokens: TokenBindings;
};

export type HostDocumentRenderer = (
  inputs: DocumentRenderingInputs,
) => Pick<Harness, "renderOnboarding" | "placeNeutralDocument">;

export type NeutralCapture = {
  readonly hookGuidance: HookGuidanceSource;
  readonly toolsGuidance: ToolsGuidanceSource;
  readonly core: URL;
  readonly sources: readonly MethodSource[];
};

export type NeutralReading = (
  capture: NeutralCapture,
) => Promise<Result<CapturedNeutralSurface, readonly ProjectionRefusal[]>>;

export type DocumentProjectionRequest = {
  readonly bindingHeadings: readonly string[];
  readonly method: Method;
  readonly host: HostIdentity;
  readonly render: HostDocumentRenderer;
  readonly surface: NeutralSurface;
  readonly fills: OnboardingFills;
  readonly tokens: TokenBindings;
};

export type DocumentProjection = (request: DocumentProjectionRequest) => Rendering;
