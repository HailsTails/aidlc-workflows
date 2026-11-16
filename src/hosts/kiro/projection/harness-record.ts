import type { HostFileDeriver } from "../../../projection/application/ports/harness.ts";
import { harnessRecordWithLine } from "../../../projection/domain/host-surface.ts";

export type KiroLayout = "agent-v1";

export const KIRO_LAYOUT: KiroLayout = "agent-v1";

const HARNESS_RECORD_PATH = ".kiro/tools/data/harness.json";

export const deriveKiroHarnessRecord: HostFileDeriver = ({ files }) => harnessRecordWithLine({
  files, path: HARNESS_RECORD_PATH, line: { key: "kiroLayout", value: KIRO_LAYOUT } });
