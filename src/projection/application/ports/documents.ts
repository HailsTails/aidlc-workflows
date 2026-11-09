import type { HostIdentity } from "../../../kernel/host.ts";
import type { Result } from "../../../kernel/result.ts";
import type { Method } from "../../../workflow-definition/domain/method.ts";
import type { MethodSource } from "../../../workflow-definition/domain/method-source.ts";
import type { NeutralSurface, OnboardingFills } from "../../domain/neutral-surface.ts";
import type { ProjectionRefusal } from "../../domain/projection.ts";
import type { TokenBindings } from "../../domain/template-token.ts";
import type { Harness, Rendering } from "./harness.ts";

export type DocumentRenderingInputs = {
  readonly fills: OnboardingFills;
  readonly tokens: TokenBindings;
};

export type HostDocumentRenderer = (
  inputs: DocumentRenderingInputs,
) => Pick<Harness, "renderOnboarding" | "placeNeutralDocument">;

export type NeutralCapture = {
  readonly core: URL;
  readonly sources: readonly MethodSource[];
};

export type NeutralReading = (
  capture: NeutralCapture,
) => Promise<Result<NeutralSurface, readonly ProjectionRefusal[]>>;

export type DocumentProjectionRequest = {
  readonly method: Method;
  readonly host: HostIdentity;
  readonly render: HostDocumentRenderer;
  readonly surface: NeutralSurface;
  readonly fills: OnboardingFills;
  readonly tokens: TokenBindings;
};

export type DocumentProjection = (request: DocumentProjectionRequest) => Rendering;
