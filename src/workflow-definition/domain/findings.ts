import type { PluginId } from "./identities.ts";
import type { OverlayAnchor, OverlayTarget } from "./contribution.ts";

export type OverlayDropReason =
  | "unknown-anchor"
  | "anchor-not-found"
  | "missing-target"
  | "anchor-collision"
  | "addition-not-allowed";

export type MethodFinding = {
  readonly kind: "overlay-dropped";
  readonly plugin: PluginId;
  readonly target: OverlayTarget;
  readonly anchor: OverlayAnchor | null;
  readonly reason: OverlayDropReason;
};
