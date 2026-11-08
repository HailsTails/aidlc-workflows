import { describe, expect, test } from "bun:test";
import {
  carveOuts,
  debtFigureOf,
  hiddenBaselineEntries,
  newDebtModules,
  staleExcludes,
} from "./zone-rules.ts";

describe("newDebtModules", () => {
  test("refuses a new TypeScript module in the debt zone", () => {
    const findings = newDebtModules([
      { path: "core/tools/aidlc-new.ts", kind: "added" },
      { path: "core/tools/aidlc-lib.ts", kind: "modified" },
      { path: "tests/golden/claude.json", kind: "added" },
      { path: "src/kernel/clock.ts", kind: "added" },
      { path: "lint/gate/domain/zone.ts", kind: "added" },
    ]);

    expect(findings).toEqual([expect.objectContaining({ subject: "core/tools/aidlc-new.ts" })]);
  });
});

describe("hiddenBaselineEntries", () => {
  test("refuses a baseline entry outside the debt zone", () => {
    const findings = hiddenBaselineEntries({
      "core/tools/aidlc-lib.ts": { "max-len": 3 },
      "src/kernel/values.ts": { "no-control-regex": 1 },
    });

    expect(findings).toEqual([
      expect.objectContaining({ subject: "boundary baseline · src/kernel/values.ts" }),
    ]);
  });
});

describe("staleExcludes", () => {
  test("passes when the recorded excludes match the zones", () => {
    expect(staleExcludes({ recorded: ["core", "tests"], generated: ["core", "tests"] })).toEqual(
      [],
    );
  });

  test("refuses a hand-edited exclude list", () => {
    const findings = staleExcludes({ recorded: ["core", "src"], generated: ["core", "tests"] });

    expect(findings).toEqual([
      expect.objectContaining({
        violation: "differs from the zones in lint/zones.ts (missing 1, extra 1)",
      }),
    ]);
  });
});

describe("carveOuts", () => {
  test("accepts only authorised locations", () => {
    const findings = carveOuts([
      { kind: "authorised-location", clause: "CD-17#clock-sources", file: "src/clock.ts" },
      { kind: "file-carve-out", clause: "CD-15#loops", file: "src/kernel/values.ts" },
      { kind: "clause-wide-carve-out", clause: "CD-43#boolean-signatures", file: undefined },
    ]);

    expect(findings).toEqual([
      expect.objectContaining({
        subject: "discipline-exceptions.json · CD-15#loops · src/kernel/values.ts",
      }),
      expect.objectContaining({
        subject: "discipline-exceptions.json · CD-43#boolean-signatures · *",
      }),
    ]);
  });
});

describe("debtFigureOf", () => {
  test("counts only debt-zone files", () => {
    const figure = debtFigureOf({
      "core/tools/aidlc-lib.ts": { "max-len": 3, complexity: 2 },
      "scripts/package.ts": { "max-len": 1 },
      "src/kernel/values.ts": { "no-control-regex": 1 },
    });

    expect(figure).toEqual({ findings: 6, files: 2 });
  });
});
