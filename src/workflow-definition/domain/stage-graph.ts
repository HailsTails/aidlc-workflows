import type { Brand } from "../../kernel/brand.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { IdentityRefusal, RuleId, ScopeName, SensorId, StageSlug } from "./identities.ts";

export type StageNumber = Brand<string, "StageNumber">;

const STAGE_NUMBER = /^[0-4]\.\d+$/;

export const stageNumber = (raw: string): Result<StageNumber, IdentityRefusal> =>
  STAGE_NUMBER.test(raw)
    ? accepted(raw as StageNumber)
    : refused({ kind: "invalid-identity", identity: "stage", raw });

export type StageNode = {
  readonly stage: StageSlug;
  readonly number: StageNumber;
  readonly enabled: boolean;
  readonly rulesInContext: readonly RuleId[];
  readonly activeSensors: readonly SensorId[];
};

export type StageGraph = {
  readonly nodes: readonly StageNode[];
};

export type ScopeColumn = {
  readonly scope: ScopeName;
  readonly stages: readonly StageSlug[];
};

export type StagePin = {
  readonly stage: StageSlug;
  readonly number: StageNumber;
};
