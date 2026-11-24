import { accepted, refused, type Result } from "../../../kernel/result.ts";
import type { HarnessRecord, HarnessRecordFacts } from "../../../projection/domain/harness-record.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";

export type KiroLayout = "agent-v1";

export const KIRO_LAYOUT: KiroLayout = "agent-v1";

export type KiroHarnessRecord = HarnessRecord & { readonly kiroLayout: KiroLayout };

export const createKiroHarnessRecord = (facts: HarnessRecordFacts): Result<KiroHarnessRecord, ProjectionRefusal> =>
  facts.identity.distribution === "kiro"
    ? accepted({ ...facts.identity, ...facts.setup, kiroLayout: KIRO_LAYOUT, ...facts.runtime })
    : refused({ kind: "render-failed", concept: "host-data", name: facts.identity.distribution,
      reason: "Kiro's harness record requires the Kiro host identity." });
