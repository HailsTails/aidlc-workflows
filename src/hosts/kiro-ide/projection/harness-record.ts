import { accepted, refused, type Result } from "../../../kernel/result.ts";
import type { HarnessRecord, HarnessRecordFacts } from "../../../projection/domain/harness-record.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";

export type KiroIdeLayout = "kas";

export const KIRO_IDE_LAYOUT: KiroIdeLayout = "kas";

export type KiroIdeHarnessRecord = HarnessRecord & { readonly kiroLayout: KiroIdeLayout };

export const createKiroIdeHarnessRecord = (facts: HarnessRecordFacts): Result<KiroIdeHarnessRecord, ProjectionRefusal> =>
  facts.identity.distribution === "kiro-ide"
    ? accepted({ ...facts.identity, ...facts.setup, kiroLayout: KIRO_IDE_LAYOUT, ...facts.runtime })
    : refused({ kind: "render-failed", concept: "host-data", name: facts.identity.distribution,
      reason: "Kiro IDE's harness record requires the Kiro IDE host identity." });
