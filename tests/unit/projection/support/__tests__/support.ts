import { expect } from "bun:test";
import { reviewerRequest } from "./fixtures.ts";
import type { NeutralDocument, Outcome, ProjectionRequest } from "../../../../../scripts/projection/src/domain/model.ts";

export const successful = <T>(outcome: Outcome<T>): T => {
  if (outcome.status === "invalid") return expect.unreachable(JSON.stringify(outcome.findings));
  return outcome.value;
};
export const rejected = <T>(outcome: Outcome<T>) => {
  if (outcome.status === "ok") return expect.unreachable("expected findings");
  return outcome.findings;
};
export const first = <T>({ entries }: { readonly entries: readonly T[] }): T => {
  const entry = entries[0];
  if (entry === undefined) return expect.unreachable("expected a fixture entry");
  return entry;
};
export const requestWith = (
  changes: {
    readonly document?: Partial<NeutralDocument>;
    readonly contract?: Partial<ProjectionRequest["contract"]>;
    readonly request?: Partial<ProjectionRequest>;
  } = {},
): ProjectionRequest => {
  const base = reviewerRequest();
  return {
    ...base,
    ...changes.request,
    documents: [{ ...first({ entries: base.documents }), ...changes.document }],
    contract: { ...base.contract, ...changes.contract },
  };
};
