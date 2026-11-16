import type { HostFileDeriver } from "../../../projection/application/ports/harness.ts";
import { harnessRecordWithLine } from "../../../projection/domain/host-surface.ts";

export type KiroIdeLayout = "kas";

export const KIRO_IDE_LAYOUT: KiroIdeLayout = "kas";

const HARNESS_RECORD_PATH = ".kiro/tools/data/harness.json";

export const deriveKiroIdeHarnessRecord: HostFileDeriver = ({ files }) => harnessRecordWithLine({
  files, path: HARNESS_RECORD_PATH, line: { key: "kiroLayout", value: KIRO_IDE_LAYOUT } });
