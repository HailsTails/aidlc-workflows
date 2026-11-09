import type { CheckId } from "../domain/outcome.ts";

export type CheckSelection = readonly CheckId[] | "all";

export type ScopeRequest = {
  readonly kind: "scope";
  readonly target: string;
  readonly baseRef: string;
  readonly record: boolean;
  readonly allTests: boolean;
  readonly waitMs: number;
  readonly only: CheckSelection;
};

export type FullRequest = {
  readonly kind: "full";
  readonly laneId: string | undefined;
  readonly baseRef: string;
  readonly build: boolean;
  readonly record: boolean;
  readonly allTests: boolean;
  readonly waitMs: number;
  readonly only: CheckSelection;
};

export type UpdateGoldensRequest = {
  readonly kind: "update-goldens";
  readonly build: boolean;
  readonly waitMs: number;
};

export type LockedRequest = {
  readonly kind: "locked";
  readonly command: readonly string[];
  readonly waitMs: number;
};

export type GateRequest =
  | { readonly kind: "help" }
  | ScopeRequest
  | FullRequest
  | UpdateGoldensRequest
  | LockedRequest;
