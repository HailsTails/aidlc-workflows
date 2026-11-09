import { describe, expect, test } from "bun:test";
import {
  isIoModule,
  judgeIsolation,
  narrowedOffenders,
  offendersOf,
  type SourceGraph,
} from "./isolation.ts";

const IMPLEMENTERS = [
  {
    file: "src/kernel/file-system.ts",
    hermeticTest: "src/kernel/file-system.hermetic.test.ts",
  },
];

const GRAPH: SourceGraph = new Map([
  ["src/a/domain/rules.ts", { imports: [], globals: [] }],
  ["src/a/domain/rules.test.ts", { imports: ["./rules.ts"], globals: [] }],
  ["src/a/adapters/disk.ts", { imports: ["node:fs/promises"], globals: [] }],
  ["src/a/adapters/disk.test.ts", { imports: ["./disk.ts"], globals: [] }],
  [
    "src/a/application/uses-kernel.test.ts",
    { imports: ["../../kernel/file-system.ts"], globals: [] },
  ],
  ["src/kernel/file-system.ts", { imports: ["node:fs/promises"], globals: [] }],
  ["src/kernel/file-system.test.ts", { imports: ["./file-system.ts"], globals: [] }],
  ["src/kernel/file-system.hermetic.test.ts", { imports: ["./file-system.ts"], globals: [] }],
  ["src/a/application/spawns.ts", { imports: [], globals: ["Bun", "console"] }],
]);

describe("isIoModule", () => {
  test("a node IO module is one, and a pure node module or a package is not", () => {
    expect([isIoModule("node:fs"), isIoModule("node:path"), isIoModule("zod")]).toEqual([
      true,
      false,
      false,
    ]);
  });
});

describe("offendersOf", () => {
  const offenders = offendersOf({ graph: GRAPH, implementers: IMPLEMENTERS });

  test("a test whose closure reaches a node IO module is an offender", () => {
    expect(offenders).toContain(
      "src/a/adapters/disk.test.ts · test reaches src/a/adapters/disk.ts",
    );
  });

  test("a test whose closure reaches a registered implementer is an offender", () => {
    expect(offenders).toContain(
      "src/a/application/uses-kernel.test.ts · test reaches src/kernel/file-system.ts",
    );
  });

  test("a pure test, the implementer's seam test and its hermetic test are not", () => {
    const fromTest = (prefix: string) =>
      offenders.filter((offender) => offender.startsWith(prefix));

    expect(fromTest("src/a/domain/rules.test.ts")).toEqual([]);
    expect(fromTest("src/kernel/file-system")).toEqual([]);
  });

  test("a file outside an implementer that uses Bun is an offender", () => {
    expect(offenders).toContain("src/a/application/spawns.ts · uses Bun");
  });
});

describe("judgeIsolation", () => {
  test("only an offender missing from the record is red", () => {
    const findings = judgeIsolation({ recorded: ["old"], measured: ["old", "fresh"] });

    expect(findings.map(({ subject }) => subject)).toEqual(["fresh"]);
  });

  test("a recorded offender that is gone drops out of the record", () => {
    expect(narrowedOffenders({ recorded: ["old", "gone"], measured: ["old"] })).toEqual(["old"]);
  });
});
