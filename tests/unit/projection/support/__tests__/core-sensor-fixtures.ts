import type { ProjectionSet } from "../../../../../scripts/projection/src/application/projection-set.ts";
import { entryBasis } from "./harness-document-fixtures.ts";
export const coreSensorContext = { harness: "claude", directory: ".claude", invocation: "bun .claude/tools/aidlc.ts", rulesSubdir: "rules" } as const;
export const coreSensorDocument = { fileName: "aidlc-example.md", origin: { ...entryBasis, path: "core/sensors/aidlc-example.md" }, text: "Authored sensor\n" };
export const coreSensorProjection = { origin: coreSensorDocument.origin, harness: "claude", resources: [{ kind: "file", path: ".claude/sensors/aidlc-example.md", body: "Rendered sensor\n" }] } as const;
export const coreSensorSet: ProjectionSet = { scope: "selected-surfaces", target: { harness: "claude", directory: ".claude" }, units: [{ kind: "sensor", key: "sensor-example", projection: coreSensorProjection }], resources: [{ kind: "file", path: ".claude/sensors/aidlc-example.md", body: "Rendered sensor\n" }] };
export const coreSensorInputs = [{ path: "core/sensors/aidlc-example.md", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }];
