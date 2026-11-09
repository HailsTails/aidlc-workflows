import { MONOLITH_FILES } from "../../context-map.ts";
import type { MonolithRecordFiles, RecordLocations } from "./ratchet-records.ts";

export const UPSTREAM_PIN = "66d08a909";

export const LIB_DECLARATIONS = "tests/fixtures/aidlc-lib-declarations.txt";

export const MONOLITH_TEST = "tests/unit/t-aidlc-lib-only-shrinks.test.ts";

const CORE_TOOLS = "core/tools/";

const recordName = (file: string): string => {
  const stem = file.replace(/\.ts$/, "");
  return stem.startsWith(CORE_TOOLS) ? stem.slice(CORE_TOOLS.length) : stem.replaceAll("/", "-");
};

export const EMIT_FILES: readonly string[] = [
  "harness/codex/emit.ts",
  "harness/copilot/emit.ts",
  "harness/opencode/emit.ts",
  "harness/claude/manifest.ts",
  "harness/codex/manifest.ts",
  "harness/copilot/manifest.ts",
  "harness/cursor/manifest.ts",
  "harness/kiro-ide/manifest.ts",
  "harness/kiro/manifest.ts",
  "harness/opencode/manifest.ts",
  "scripts/manifest-types.ts",
];

export const MEMBER_TYPES: Readonly<Record<string, readonly string[]>> = {
  "scripts/manifest-types.ts": ["EmitContext"],
};

const declarationsRecordOf = (file: string): MonolithRecordFiles => ({
  file,
  declarations: file.endsWith("/aidlc-lib.ts")
    ? LIB_DECLARATIONS
    : `tests/ratchets/${recordName(file)}-declarations.txt`,
});

export const RECORD_LOCATIONS: RecordLocations = {
  boundary: "lint/boundary-baseline.json",
  monolithLines: "tests/ratchets/monolith-lines.json",
  monoliths: [...MONOLITH_FILES, ...EMIT_FILES].map(declarationsRecordOf),
  upstream: UPSTREAM_PIN,
};
