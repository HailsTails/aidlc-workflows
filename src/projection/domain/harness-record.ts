import type { HostIdentity } from "../../kernel/host.ts";
import { accepted, type Result } from "../../kernel/result.ts";
import type { HostData } from "./host-surface.ts";
import type { ProjectionRefusal } from "./projection.ts";

export type HarnessRecordFacts = {
  readonly identity: {
    readonly schemaVersion: 1;
    readonly distribution: HostIdentity["distribution"];
    readonly productName: string;
    readonly configNextStep: string;
    readonly name: HostIdentity["distribution"];
    readonly harnessDir: HostIdentity["directory"];
  };
  readonly setup: { readonly rulesSubdir: string } & Pick<HostData,
    "runnerFrontmatterAdditions" | "documentExtractors" | "hookActivation" | "newChatStep">;
  readonly runtime: Pick<HostData, "directiveMaxBytes" | "statusLine" | "agentFinishRecorded" | "hostShell">;
};

export type HarnessRecord = HarnessRecordFacts["identity"] & HarnessRecordFacts["setup"]
  & HarnessRecordFacts["runtime"];

const COMMON_RECORD_FIELDS = [
  "schemaVersion", "distribution", "productName", "configNextStep", "name", "harnessDir",
  "rulesSubdir", "runnerFrontmatterAdditions", "documentExtractors", "hookActivation", "newChatStep",
  "directiveMaxBytes", "statusLine", "agentFinishRecorded", "hostShell",
] as const satisfies readonly (keyof HarnessRecord)[];

export const commonHarnessRecord = (facts: HarnessRecordFacts): Result<HarnessRecord, ProjectionRefusal> =>
  accepted({ ...facts.identity, ...facts.setup, ...facts.runtime });

export const harnessRecordConflicts = (request: {
  readonly facts: HarnessRecordFacts; readonly record: HarnessRecord;
}): readonly string[] => {
  const expected = { ...request.facts.identity, ...request.facts.setup, ...request.facts.runtime };
  return COMMON_RECORD_FIELDS.filter((key) => Object.hasOwn(request.record, key) !== Object.hasOwn(expected, key)
    || request.record[key] !== expected[key]);
};
