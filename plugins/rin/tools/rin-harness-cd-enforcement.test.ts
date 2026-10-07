import { describe, expect, expectTypeOf, test } from "vitest";
import {
  type CdSensorResult,
  cdSensorPassOf,
  cdSensorWireLineOf,
  cdSensorWireOf,
  doublyHeldPathsOf,
  type ExemptionOutcome,
  exemptionOutcomeOf,
  fileModeResultOf,
  isSameNormalPath,
  type NormalPath,
  normalPathOf,
  projectModeResultOf,
  runCdSensorFileMode,
  scannedTextOf,
  unmatchedExemptPathsOf,
  type Violation,
  writerNoticeOf,
} from "./rin-harness-cd-enforcement.ts";
import {
  type PathFlavour,
  pathOperationsFor,
} from "./rin-harness-path-operations.ts";

const win32Operations = pathOperationsFor({ flavour: "win32" });
const posixOperations = pathOperationsFor({ flavour: "posix" });

const win32NormalPathOf = ({ path }: { readonly path: string }): NormalPath =>
  normalPathOf({
    pathOperations: win32Operations,
    projectDir: "C:\\repo",
    path,
  });

const posixNormalPathOf = ({ path }: { readonly path: string }): NormalPath =>
  normalPathOf({
    pathOperations: posixOperations,
    projectDir: "/repo",
    path,
  });

describe("normalPathOf", () => {
  test("gives an absolute path inside the project its forward-slashed relative form", () => {
    expect(win32NormalPathOf({ path: "C:\\repo\\src\\a.ts" })).toMatchObject({
      kind: "inside",
      flavour: "win32",
      path: "src/a.ts",
    });
  });

  test("gives a project-relative path the same normal form", () => {
    expect(win32NormalPathOf({ path: "src\\a.ts" })).toMatchObject({
      kind: "inside",
      path: "src/a.ts",
    });
  });

  test("drops a leading ./ segment", () => {
    expect(win32NormalPathOf({ path: "./src/a.ts" })).toMatchObject({
      kind: "inside",
      path: "src/a.ts",
    });
  });

  test("collapses a .. segment that stays inside the project", () => {
    expect(win32NormalPathOf({ path: "src/../src/a.ts" })).toMatchObject({
      kind: "inside",
      path: "src/a.ts",
    });
  });

  test("collapses an absolute path that climbs out of the project and back in", () => {
    expect(
      win32NormalPathOf({ path: "C:\\repo\\..\\repo\\src\\a.ts" }),
    ).toMatchObject({
      kind: "inside",
      path: "src/a.ts",
    });
  });

  test("places a path that climbs out of the project outside", () => {
    expect(win32NormalPathOf({ path: "..\\a.ts" })).toEqual({
      kind: "outside",
    });
  });

  test("places a sibling directory of the project outside", () => {
    expect(win32NormalPathOf({ path: "C:\\other\\a.ts" })).toEqual({
      kind: "outside",
    });
  });

  test("places a sibling directory whose name extends the project's outside", () => {
    expect(win32NormalPathOf({ path: "C:\\repo-other\\a.ts" })).toEqual({
      kind: "outside",
    });
  });

  test("places a path on another drive outside", () => {
    expect(win32NormalPathOf({ path: "D:\\repo\\src\\a.ts" })).toEqual({
      kind: "outside",
    });
  });

  test("keeps a file whose name begins with two dots inside", () => {
    expect(win32NormalPathOf({ path: "..hidden.ts" })).toMatchObject({
      kind: "inside",
      path: "..hidden.ts",
    });
  });

  test("resolves with posix rules under the posix flavour", () => {
    expect(posixNormalPathOf({ path: "/repo/src/a.ts" })).toMatchObject({
      kind: "inside",
      flavour: "posix",
      path: "src/a.ts",
    });
  });

  test("places a posix path that climbs out of the project outside", () => {
    expect(posixNormalPathOf({ path: "/repo/../other/a.ts" })).toEqual({
      kind: "outside",
    });
  });

  test("gives the same answer for an absolute project path on either host", () => {
    expect(
      normalPathOf({
        pathOperations: posixOperations,
        projectDir: "/srv/rin",
        path: "/srv/rin/packages/kernel/src/middleware/compose.ts",
      }),
    ).toMatchObject({
      kind: "inside",
      path: "packages/kernel/src/middleware/compose.ts",
    });
  });
});

describe("the inside normal form", () => {
  test("cannot be built by hand outside normalPathOf", () => {
    expectTypeOf<{
      readonly kind: "inside";
      readonly flavour: PathFlavour;
      readonly path: string;
    }>().not.toExtend<NormalPath>();
  });
});

describe("isSameNormalPath", () => {
  test("matches the same file named absolutely and relatively", () => {
    expect(
      isSameNormalPath({
        left: win32NormalPathOf({ path: "C:\\repo\\src\\a.ts" }),
        right: win32NormalPathOf({ path: "src/a.ts" }),
      }),
    ).toBe(true);
  });

  test("does not match a same-name file in another directory", () => {
    expect(
      isSameNormalPath({
        left: win32NormalPathOf({ path: "C:\\repo\\src\\a.ts" }),
        right: win32NormalPathOf({ path: "zz-tmp-probe/a.ts" }),
      }),
    ).toBe(false);
  });

  test("does not match a file whose path ends with the other's path", () => {
    expect(
      isSameNormalPath({
        left: win32NormalPathOf({ path: "src/a.ts" }),
        right: win32NormalPathOf({ path: "zz-probe/src/a.ts" }),
      }),
    ).toBe(false);
  });

  test("ignores drive-letter and directory case under win32", () => {
    expect(
      isSameNormalPath({
        left: win32NormalPathOf({ path: "c:\\REPO\\Src\\a.ts" }),
        right: win32NormalPathOf({ path: "C:\\repo\\src\\a.ts" }),
      }),
    ).toBe(true);
  });

  test("respects case under posix", () => {
    expect(
      isSameNormalPath({
        left: posixNormalPathOf({ path: "/repo/Src/a.ts" }),
        right: posixNormalPathOf({ path: "/repo/src/a.ts" }),
      }),
    ).toBe(false);
  });

  test("never matches an outside path, even to itself", () => {
    expect(
      isSameNormalPath({
        left: win32NormalPathOf({ path: "..\\a.ts" }),
        right: win32NormalPathOf({ path: "..\\a.ts" }),
      }),
    ).toBe(false);
  });

  test("never matches two paths of different flavours", () => {
    expect(
      isSameNormalPath({
        left: win32NormalPathOf({ path: "src/a.ts" }),
        right: posixNormalPathOf({ path: "src/a.ts" }),
      }),
    ).toBe(false);
  });
});

const violationAtFile = (file: string): Violation => ({
  rule: "CD-23",
  file,
  line: 1,
  snippet: "irrelevant",
});

const clockViolationInTarget: Violation = {
  rule: "CD-17",
  file: "packages/kernel/src/middleware/compose.ts",
  line: 25,
  snippet: "const now = Date.now();",
};

const clockViolationInSameNameFileElsewhere: Violation = {
  rule: "CD-17",
  file: "packages/kernel/src/middleware/zz-probe/compose.ts",
  line: 25,
  snippet: "const now = Date.now();",
};

const clockViolationNamedAbsolutely: Violation = {
  rule: "CD-17",
  file: "C:/repo/packages/kernel/src/middleware/compose.ts",
  line: 5,
  snippet: "new Date()",
};

const clockViolationInCarvedFile: Violation = {
  rule: "CD-17",
  file: "packages/kernel/src/carved.ts",
  line: 7,
  snippet: "Date.now()",
};

const clockViolationInAuthorisedFile: Violation = {
  rule: "CD-17",
  file: "packages/kernel/src/clock.ts",
  line: 2,
  snippet: "Date.now()",
};

const outcomeHolding = ({
  violations,
}: {
  readonly violations: readonly Violation[];
}): ExemptionOutcome => ({
  violations,
  staleAuthorisedPaths: [],
  staleCarvedPaths: [],
  doublyHeldPaths: [],
});

const composeTargetWin32 =
  "C:\\repo\\packages\\kernel\\src\\middleware\\compose.ts";

describe("fileModeResultOf", () => {
  test("keeps only the target file's violations, attributed by normal-form path", () => {
    expect(
      fileModeResultOf({
        cd: "CD-17",
        target: composeTargetWin32,
        projectDir: "C:\\repo",
        pathOperations: win32Operations,
        outcome: outcomeHolding({
          violations: [
            clockViolationInTarget,
            clockViolationInSameNameFileElsewhere,
          ],
        }),
      }),
    ).toEqual({
      evaluation: "file",
      cd: "CD-17",
      violations: [clockViolationInTarget],
      scanned: "packages/kernel/src/middleware/compose.ts",
      staleAuthorisedPaths: [],
      staleCarvedPaths: [],
      doublyHeldPaths: [],
    });
  });

  test("matches a target given with a lower-case drive letter", () => {
    expect(
      fileModeResultOf({
        cd: "CD-17",
        target: "c:\\repo\\packages\\kernel\\src\\middleware\\compose.ts",
        projectDir: "C:\\repo",
        pathOperations: win32Operations,
        outcome: outcomeHolding({ violations: [clockViolationInTarget] }),
      }).violations,
    ).toEqual([clockViolationInTarget]);
  });

  test("matches a target spelled with ./ and .. segments", () => {
    expect(
      fileModeResultOf({
        cd: "CD-17",
        target: "./packages/kernel/src/../src/middleware/compose.ts",
        projectDir: "C:\\repo",
        pathOperations: win32Operations,
        outcome: outcomeHolding({ violations: [clockViolationInTarget] }),
      }).violations,
    ).toEqual([clockViolationInTarget]);
  });

  test("rewrites a violation named by an absolute path to its normal form", () => {
    expect(
      fileModeResultOf({
        cd: "CD-17",
        target: "packages/kernel/src/middleware/compose.ts",
        projectDir: "C:\\repo",
        pathOperations: win32Operations,
        outcome: outcomeHolding({
          violations: [clockViolationNamedAbsolutely],
        }),
      }).violations,
    ).toEqual([
      {
        ...clockViolationNamedAbsolutely,
        file: "packages/kernel/src/middleware/compose.ts",
      },
    ]);
  });

  test("finds nothing in a target whose only same-name match lives elsewhere", () => {
    expect(
      fileModeResultOf({
        cd: "CD-17",
        target: composeTargetWin32,
        projectDir: "C:\\repo",
        pathOperations: win32Operations,
        outcome: outcomeHolding({
          violations: [clockViolationInSameNameFileElsewhere],
        }),
      }),
    ).toMatchObject({ evaluation: "file", violations: [] });
  });

  test("attributes by posix rules on a posix host", () => {
    expect(
      fileModeResultOf({
        cd: "CD-17",
        target: "/srv/rin/packages/kernel/src/middleware/compose.ts",
        projectDir: "/srv/rin",
        pathOperations: posixOperations,
        outcome: outcomeHolding({
          violations: [
            clockViolationInTarget,
            clockViolationInSameNameFileElsewhere,
          ],
        }),
      }).violations,
    ).toEqual([clockViolationInTarget]);
  });

  test("does not evaluate a target outside the project and names it as given", () => {
    expect(
      fileModeResultOf({
        cd: "CD-17",
        target: "C:\\other\\compose.ts",
        projectDir: "C:\\repo",
        pathOperations: win32Operations,
        outcome: outcomeHolding({ violations: [clockViolationInTarget] }),
      }),
    ).toMatchObject({
      evaluation: "not-evaluated",
      violations: [],
      scanned: "C:\\other\\compose.ts (out of scope)",
    });
  });

  test("carries no stale exemption paths, which are project-mode findings", () => {
    expect(
      fileModeResultOf({
        cd: "CD-17",
        target: composeTargetWin32,
        projectDir: "C:\\repo",
        pathOperations: win32Operations,
        outcome: {
          violations: [],
          staleAuthorisedPaths: ["packages/gone.ts"],
          staleCarvedPaths: ["packages/also-gone.ts"],
          doublyHeldPaths: ["packages/both.ts"],
        },
      }),
    ).toMatchObject({
      staleAuthorisedPaths: [],
      staleCarvedPaths: [],
      doublyHeldPaths: [],
    });
  });
});

describe("exemptionOutcomeOf", () => {
  test("removes violations in carved and authorised files and keeps the rest", () => {
    expect(
      exemptionOutcomeOf({
        violations: [
          clockViolationInTarget,
          clockViolationInCarvedFile,
          clockViolationInAuthorisedFile,
        ],
        carvedFiles: ["packages/kernel/src/carved.ts"],
        authorisedPaths: ["packages/kernel/src/clock.ts"],
      }),
    ).toEqual({
      violations: [clockViolationInTarget],
      staleAuthorisedPaths: [],
      staleCarvedPaths: [],
      doublyHeldPaths: [],
    });
  });

  test("names a carved path that suppresses nothing as stale", () => {
    expect(
      exemptionOutcomeOf({
        violations: [clockViolationInTarget],
        carvedFiles: ["packages/kernel/src/carved.ts"],
        authorisedPaths: [],
      }).staleCarvedPaths,
    ).toEqual(["packages/kernel/src/carved.ts"]);
  });
});

const parityOutcome = exemptionOutcomeOf({
  violations: [
    clockViolationInTarget,
    clockViolationInSameNameFileElsewhere,
    clockViolationInCarvedFile,
    clockViolationInAuthorisedFile,
  ],
  carvedFiles: ["packages/kernel/src/carved.ts"],
  authorisedPaths: ["packages/kernel/src/clock.ts"],
});

describe("file mode and project mode read one exemption outcome (FR-2)", () => {
  test("project mode holds every unexempt violation", () => {
    expect(
      projectModeResultOf({
        cd: "CD-17",
        walker: "constitution",
        outcome: parityOutcome,
      }).violations,
    ).toEqual([clockViolationInTarget, clockViolationInSameNameFileElsewhere]);
  });

  test("file mode holds the project-mode violations in the target and no others", () => {
    expect(
      fileModeResultOf({
        cd: "CD-17",
        target: composeTargetWin32,
        projectDir: "C:\\repo",
        pathOperations: win32Operations,
        outcome: parityOutcome,
      }).violations,
    ).toEqual([clockViolationInTarget]);
  });

  test("file mode finds nothing when the target is a carved file", () => {
    expect(
      fileModeResultOf({
        cd: "CD-17",
        target: "C:\\repo\\packages\\kernel\\src\\carved.ts",
        projectDir: "C:\\repo",
        pathOperations: win32Operations,
        outcome: parityOutcome,
      }).violations,
    ).toEqual([]);
  });

  test("file mode finds nothing when the target is an authorised location", () => {
    expect(
      fileModeResultOf({
        cd: "CD-17",
        target: "C:\\repo\\packages\\kernel\\src\\clock.ts",
        projectDir: "C:\\repo",
        pathOperations: win32Operations,
        outcome: parityOutcome,
      }).violations,
    ).toEqual([]);
  });
});

describe("projectModeResultOf", () => {
  test("names the walker and the CD it filtered to", () => {
    expect(
      projectModeResultOf({
        cd: "CD-17",
        walker: "constitution",
        outcome: outcomeHolding({ violations: [] }),
      }),
    ).toEqual({
      evaluation: "project",
      cd: "CD-17",
      violations: [],
      scanned: "project scope, constitution walker filtered to CD-17",
      staleAuthorisedPaths: [],
      staleCarvedPaths: [],
      doublyHeldPaths: [],
    });
  });
});

describe("scannedTextOf", () => {
  test("names a missing target inside the project by its normal form", () => {
    expect(
      scannedTextOf({
        pathOperations: win32Operations,
        projectDir: "C:\\repo",
        target: "C:\\repo\\src\\gone.ts",
        suffix: " (missing)",
      }),
    ).toBe("src/gone.ts (missing)");
  });

  test("names a missing target outside the project as given", () => {
    expect(
      scannedTextOf({
        pathOperations: win32Operations,
        projectDir: "C:\\repo",
        target: "D:\\elsewhere\\gone.ts",
        suffix: " (missing)",
      }),
    ).toBe("D:\\elsewhere\\gone.ts (missing)");
  });

  test("names an out-of-scope target inside the project by its normal form", () => {
    expect(
      scannedTextOf({
        pathOperations: win32Operations,
        projectDir: "C:\\repo",
        target: "C:\\repo\\docs\\notes.md",
        suffix: " (out of scope)",
      }),
    ).toBe("docs/notes.md (out of scope)");
  });
});

describe("runCdSensorFileMode without an enforcement entry", () => {
  test("does not evaluate and names the target as given", () => {
    expect(
      runCdSensorFileMode({
        cdId: "CD-999",
        target: "C:\\repo\\src\\a.ts",
        projectDir: "C:\\repo",
        pathOperations: win32Operations,
      }),
    ).toMatchObject({
      evaluation: "not-evaluated",
      violations: [],
      scanned: "C:\\repo\\src\\a.ts",
    });
  });
});

const violationOnLine = ({ line }: { readonly line: number }): Violation => ({
  rule: "CD-17",
  file: "src/a.ts",
  line,
  snippet: "Date.now()",
});

const tenViolations: readonly Violation[] = [
  violationOnLine({ line: 1 }),
  violationOnLine({ line: 2 }),
  violationOnLine({ line: 3 }),
  violationOnLine({ line: 4 }),
  violationOnLine({ line: 5 }),
  violationOnLine({ line: 6 }),
  violationOnLine({ line: 7 }),
  violationOnLine({ line: 8 }),
  violationOnLine({ line: 9 }),
  violationOnLine({ line: 10 }),
];

const twelveViolations: readonly Violation[] = [
  ...tenViolations,
  violationOnLine({ line: 11 }),
  violationOnLine({ line: 12 }),
];

const tenNoticeLines: readonly string[] = [
  "CD-17 src/a.ts:1 — Date.now()",
  "CD-17 src/a.ts:2 — Date.now()",
  "CD-17 src/a.ts:3 — Date.now()",
  "CD-17 src/a.ts:4 — Date.now()",
  "CD-17 src/a.ts:5 — Date.now()",
  "CD-17 src/a.ts:6 — Date.now()",
  "CD-17 src/a.ts:7 — Date.now()",
  "CD-17 src/a.ts:8 — Date.now()",
  "CD-17 src/a.ts:9 — Date.now()",
  "CD-17 src/a.ts:10 — Date.now()",
];

const snippetViolation = ({
  snippet,
}: {
  readonly snippet: string;
}): Violation => ({
  rule: "CD-17",
  file: "src/a.ts",
  line: 3,
  snippet,
});

describe("writerNoticeOf", () => {
  test("is silent when there are no violations", () => {
    expect(writerNoticeOf({ cd: "CD-17", violations: [] })).toEqual({
      kind: "silent",
    });
  });

  test("names each violation's rule, path and line with its snippet, in walker order", () => {
    expect(
      writerNoticeOf({
        cd: "CD-17",
        violations: [
          violationOnLine({ line: 9 }),
          violationOnLine({ line: 2 }),
        ],
      }),
    ).toEqual({
      kind: "notice",
      text: "CD-17 src/a.ts:9 — Date.now()\nCD-17 src/a.ts:2 — Date.now()",
    });
  });

  test("cuts a snippet at its first CRLF newline", () => {
    expect(
      writerNoticeOf({
        cd: "CD-17",
        violations: [
          snippetViolation({ snippet: "first line\r\nsecond line" }),
        ],
      }),
    ).toEqual({ kind: "notice", text: "CD-17 src/a.ts:3 — first line" });
  });

  test("cuts a snippet at its first LF newline", () => {
    expect(
      writerNoticeOf({
        cd: "CD-17",
        violations: [
          snippetViolation({ snippet: "first line\nsecond line\nthird" }),
        ],
      }),
    ).toEqual({ kind: "notice", text: "CD-17 src/a.ts:3 — first line" });
  });

  test("cuts a long first line at the limit before its newline", () => {
    expect(
      writerNoticeOf({
        cd: "CD-17",
        violations: [
          snippetViolation({ snippet: `${"a".repeat(170)}\nsecond line` }),
        ],
      }),
    ).toEqual({
      kind: "notice",
      text: `CD-17 src/a.ts:3 — ${"a".repeat(160)}`,
    });
  });

  test("keeps a snippet exactly at the character limit whole", () => {
    expect(
      writerNoticeOf({
        cd: "CD-17",
        violations: [snippetViolation({ snippet: "b".repeat(160) })],
      }),
    ).toEqual({
      kind: "notice",
      text: `CD-17 src/a.ts:3 — ${"b".repeat(160)}`,
    });
  });

  test("cuts a snippet one past the character limit", () => {
    expect(
      writerNoticeOf({
        cd: "CD-17",
        violations: [snippetViolation({ snippet: "c".repeat(161) })],
      }),
    ).toEqual({
      kind: "notice",
      text: `CD-17 src/a.ts:3 — ${"c".repeat(160)}`,
    });
  });

  test("lists exactly the violation limit with no remainder line", () => {
    expect(writerNoticeOf({ cd: "CD-17", violations: tenViolations })).toEqual({
      kind: "notice",
      text: tenNoticeLines.join("\n"),
    });
  });

  test("lists at most the violation limit and names the remainder", () => {
    expect(
      writerNoticeOf({ cd: "CD-17", violations: twelveViolations }),
    ).toEqual({
      kind: "notice",
      text: [
        ...tenNoticeLines,
        "… and 2 more CD-17 violations in this file",
      ].join("\n"),
    });
  });
});

const failingFileResult: CdSensorResult = fileModeResultOf({
  cd: "CD-17",
  target: "C:\\repo\\src\\a.ts",
  projectDir: "C:\\repo",
  pathOperations: win32Operations,
  outcome: outcomeHolding({ violations: [violationOnLine({ line: 3 })] }),
});

const cleanFileResult: CdSensorResult = fileModeResultOf({
  cd: "CD-17",
  target: "C:\\repo\\src\\a.ts",
  projectDir: "C:\\repo",
  pathOperations: win32Operations,
  outcome: outcomeHolding({ violations: [] }),
});

const outsideFileResult: CdSensorResult = fileModeResultOf({
  cd: "CD-17",
  target: "C:\\other\\a.ts",
  projectDir: "C:\\repo",
  pathOperations: win32Operations,
  outcome: outcomeHolding({ violations: [violationOnLine({ line: 3 })] }),
});

const failingProjectResult: CdSensorResult = projectModeResultOf({
  cd: "CD-17",
  walker: "constitution",
  outcome: outcomeHolding({ violations: [violationOnLine({ line: 3 })] }),
});

const staleProjectResult: CdSensorResult = projectModeResultOf({
  cd: "CD-17",
  walker: "constitution",
  outcome: {
    violations: [],
    staleAuthorisedPaths: [],
    staleCarvedPaths: ["packages/gone.ts"],
    doublyHeldPaths: [],
  },
});

const cleanProjectResult: CdSensorResult = projectModeResultOf({
  cd: "CD-17",
  walker: "constitution",
  outcome: outcomeHolding({ violations: [] }),
});

describe("a sensor result stores no pass flag (DM-3)", () => {
  test("so a pass beside a notice cannot be built", () => {
    expectTypeOf<CdSensorResult>().not.toHaveProperty("pass");
  });
});

describe("cdSensorPassOf", () => {
  test("fails a file-mode result with a violation", () => {
    expect(cdSensorPassOf({ sensorResult: failingFileResult })).toBe(false);
  });

  test("passes a file-mode result with no violation", () => {
    expect(cdSensorPassOf({ sensorResult: cleanFileResult })).toBe(true);
  });

  test("passes a result that was not evaluated", () => {
    expect(cdSensorPassOf({ sensorResult: outsideFileResult })).toBe(true);
  });

  test("fails a project-mode result with a violation", () => {
    expect(cdSensorPassOf({ sensorResult: failingProjectResult })).toBe(false);
  });

  test("fails a project-mode result with only a stale exemption path", () => {
    expect(cdSensorPassOf({ sensorResult: staleProjectResult })).toBe(false);
  });

  test("passes a clean project-mode result", () => {
    expect(cdSensorPassOf({ sensorResult: cleanProjectResult })).toBe(true);
  });
});

describe("cdSensorWireOf", () => {
  test("carries the writer notice on a file-mode finding", () => {
    expect(cdSensorWireOf({ result: failingFileResult })).toHaveProperty(
      "writer_notice",
      "CD-17 src/a.ts:3 — Date.now()",
    );
  });

  test("fails a file-mode finding on the wire", () => {
    expect(cdSensorWireOf({ result: failingFileResult })).toHaveProperty(
      "pass",
      false,
    );
  });

  test("omits the writer notice key on a file-mode pass", () => {
    expect(cdSensorWireOf({ result: cleanFileResult })).not.toHaveProperty(
      "writer_notice",
    );
  });

  test("omits the writer notice key on a project-mode finding", () => {
    expect(cdSensorWireOf({ result: failingProjectResult })).not.toHaveProperty(
      "writer_notice",
    );
  });

  test("omits the writer notice key on a target that was not evaluated", () => {
    expect(cdSensorWireOf({ result: outsideFileResult })).not.toHaveProperty(
      "writer_notice",
    );
  });

  test("fails a project-mode wire held only by a stale exemption path", () => {
    expect(cdSensorWireLineOf({ sensorResult: staleProjectResult })).toBe(
      '{"pass":false,"cd":"CD-17","findings_count":0,"findings":[],"scanned":"project scope, constitution walker filtered to CD-17","stale_authorised_paths":[],"stale_carved_paths":["packages/gone.ts"],"doubly_held_paths":[]}\n',
    );
  });
});

describe("cdSensorWireLineOf", () => {
  test("serialises the wire as one JSON line ending in a newline", () => {
    expect(cdSensorWireLineOf({ sensorResult: failingFileResult })).toBe(
      '{"pass":false,"cd":"CD-17","findings_count":1,"findings":[{"rule":"CD-17","file":"src/a.ts","line":3,"snippet":"Date.now()"}],"scanned":"src/a.ts","stale_authorised_paths":[],"stale_carved_paths":[],"doubly_held_paths":[],"writer_notice":"CD-17 src/a.ts:3 — Date.now()"}\n',
    );
  });

  test("serialises a pass with no writer notice key", () => {
    expect(cdSensorWireLineOf({ sensorResult: cleanFileResult })).toBe(
      '{"pass":true,"cd":"CD-17","findings_count":0,"findings":[],"scanned":"src/a.ts","stale_authorised_paths":[],"stale_carved_paths":[],"doubly_held_paths":[]}\n',
    );
  });
});

describe("unmatchedExemptPathsOf", () => {
  test("omits an exempt path matched by a violation", () => {
    expect(
      unmatchedExemptPathsOf({
        exemptPaths: ["scripts/ledger.ts"],
        violations: [violationAtFile("scripts/ledger.ts")],
      }),
    ).toEqual([]);
  });

  test("omits an exempt path matched via forward-slash violation against a backslash exempt path", () => {
    expect(
      unmatchedExemptPathsOf({
        exemptPaths: ["scripts\\ledger.ts"],
        violations: [violationAtFile("repo/scripts/ledger.ts")],
      }),
    ).toEqual([]);
  });

  test("returns an exempt path with no matching violation", () => {
    expect(
      unmatchedExemptPathsOf({
        exemptPaths: ["scripts/ledger.ts"],
        violations: [violationAtFile("scripts/other.ts")],
      }),
    ).toEqual(["scripts/ledger.ts"]);
  });

  test("returns every exempt path when violations are empty", () => {
    expect(
      unmatchedExemptPathsOf({
        exemptPaths: ["scripts/ledger.ts", "scripts/other.ts"],
        violations: [],
      }),
    ).toEqual(["scripts/ledger.ts", "scripts/other.ts"]);
  });
});

describe("doublyHeldPathsOf", () => {
  test("returns a path held in both carvedFiles and authorisedPaths", () => {
    expect(
      doublyHeldPathsOf({
        carvedFiles: ["scripts/ledger.ts"],
        authorisedPaths: ["scripts/ledger.ts"],
      }),
    ).toEqual(["scripts/ledger.ts"]);
  });

  test("returns a doubly-held path when one side is backslash-separated", () => {
    expect(
      doublyHeldPathsOf({
        carvedFiles: ["scripts\\ledger.ts"],
        authorisedPaths: ["scripts/ledger.ts"],
      }),
    ).toEqual(["scripts\\ledger.ts"]);
  });

  test("returns empty for disjoint lists", () => {
    expect(
      doublyHeldPathsOf({
        carvedFiles: ["scripts/a.ts"],
        authorisedPaths: ["scripts/b.ts"],
      }),
    ).toEqual([]);
  });
});
