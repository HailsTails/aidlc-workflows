import { MONOLITH_FILES } from "../../context-map.ts";
import type { MonolithRecordFiles, RecordLocations } from "./ratchet-records.ts";

export const UPSTREAM_PIN = "66d08a909";

export const LIB_DECLARATIONS = "tests/fixtures/aidlc-lib-declarations.txt";

export const MONOLITH_TEST = "tests/unit/t-aidlc-lib-only-shrinks.test.ts";

const basename = (file: string): string => file.split("/").at(-1)?.replace(/\.ts$/, "") ?? file;

const declarationsRecordOf = (file: string): MonolithRecordFiles => ({
  file,
  declarations: file.endsWith("/aidlc-lib.ts")
    ? LIB_DECLARATIONS
    : `tests/ratchets/${basename(file)}-declarations.txt`,
});

export const RECORD_LOCATIONS: RecordLocations = {
  boundary: "lint/boundary-baseline.json",
  monolithLines: "tests/ratchets/monolith-lines.json",
  monoliths: MONOLITH_FILES.map(declarationsRecordOf),
  upstream: UPSTREAM_PIN,
};
