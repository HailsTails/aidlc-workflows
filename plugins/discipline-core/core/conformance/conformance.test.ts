import { describe, expect, it, vi } from "vitest";
import type { LoadedRunner, RunnerClause } from "../mechanism-port/runner-module-schema.ts";
import type { SourceCase } from "../rule-set-reader/rule-set-reader.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import { checkConformance } from "./conformance.ts";

const CLASS_SYNTAX_OBJECT = { ruleSet: "shared", discipline: "CD-14", clause: "class-syntax" };

const CLASS_SYNTAX_CLAUSE: RunnerClause = {
  address: clauseAddressSchema.parse("CD-14#class-syntax"),
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: "/install/mechanisms/audit/CD-14",
  settings: { module: "class-syntax.ts" },
};

const CLASS_ON_LINES_1_AND_3: SourceCase = {
  name: "two classes",
  fileName: repoPathSchema.parse("src/two-classes.ts"),
  source: "class A {}\nconst b = 1;\nclass C {}\n",
  expectedLines: [1, 3],
};

const NO_CLASS: SourceCase = {
  name: "no class",
  fileName: repoPathSchema.parse("src/no-class.ts"),
  source: "const b = 1;\n",
  expectedLines: [],
};

const CASES: readonly SourceCase[] = [CLASS_ON_LINES_1_AND_3, NO_CLASS];

const conformingWith = (returned: unknown): LoadedRunner => ({
  exceptionPath: "standalone",
  run: vi.fn<LoadedRunner["run"]>().mockResolvedValue({ outcome: "ok", value: [] }),
  conform: vi.fn<LoadedRunner["conform"]>().mockResolvedValue(returned),
});

const conformanceOf = (request: { readonly runner: LoadedRunner }) =>
  checkConformance({ clause: CLASS_SYNTAX_CLAUSE, cases: CASES, runner: request.runner });

describe("checkConformance", () => {
  it("has no failures when every case's flagged lines equal its expected lines", async () => {
    await expect(
      conformanceOf({
        runner: conformingWith({
          outcome: "ok",
          value: [
            { caseName: "two classes", flaggedLines: [1, 3] },
            { caseName: "no class", flaggedLines: [] },
          ],
        }),
      }),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });

  it("calls conform once with the clause and the cases and never calls run", async () => {
    const runner = conformingWith({
      outcome: "ok",
      value: [
        { caseName: "two classes", flaggedLines: [1, 3] },
        { caseName: "no class", flaggedLines: [] },
      ],
    });
    const conformance = await conformanceOf({ runner });
    expect({
      conformance,
      conformCalls: vi.mocked(runner.conform).mock.calls,
      runCalls: vi.mocked(runner.run).mock.calls,
    }).toEqual({
      conformance: { outcome: "ok", value: [] },
      conformCalls: [[{ clause: CLASS_SYNTAX_CLAUSE, cases: CASES }]],
      runCalls: [],
    });
  });

  it("compares flagged lines as a set, ignoring their order", async () => {
    await expect(
      conformanceOf({
        runner: conformingWith({
          outcome: "ok",
          value: [
            { caseName: "no class", flaggedLines: [] },
            { caseName: "two classes", flaggedLines: [3, 1] },
          ],
        }),
      }),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });

  it("compares flagged lines as a set, tolerating a line flagged twice", async () => {
    await expect(
      conformanceOf({
        runner: conformingWith({
          outcome: "ok",
          value: [
            { caseName: "two classes", flaggedLines: [1, 3, 3] },
            { caseName: "no class", flaggedLines: [] },
          ],
        }),
      }),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });

  it("reports a case whose flagged lines miss an expected line", async () => {
    await expect(
      conformanceOf({
        runner: conformingWith({
          outcome: "ok",
          value: [
            { caseName: "two classes", flaggedLines: [1] },
            { caseName: "no class", flaggedLines: [] },
          ],
        }),
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [{ clause: CLASS_SYNTAX_OBJECT, caseName: "two classes", expectedLines: [1, 3], flaggedLines: [1] }],
    });
  });

  it("reports an allow case whose runner flagged a line", async () => {
    await expect(
      conformanceOf({
        runner: conformingWith({
          outcome: "ok",
          value: [
            { caseName: "two classes", flaggedLines: [1, 3] },
            { caseName: "no class", flaggedLines: [1] },
          ],
        }),
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [{ clause: CLASS_SYNTAX_OBJECT, caseName: "no class", expectedLines: [], flaggedLines: [1] }],
    });
  });

  it("reports a failing case's expected and flagged lines as sorted, de-duplicated sets", async () => {
    await expect(
      checkConformance({
        clause: CLASS_SYNTAX_CLAUSE,
        cases: [{ ...CLASS_ON_LINES_1_AND_3, expectedLines: [3, 1, 3] }],
        runner: conformingWith({ outcome: "ok", value: [{ caseName: "two classes", flaggedLines: [5, 1, 5, 2] }] }),
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: [{ clause: CLASS_SYNTAX_OBJECT, caseName: "two classes", expectedLines: [1, 3], flaggedLines: [1, 2, 5] }],
    });
  });

  it("is runner-invalid-output when the verdicts miss a case", async () => {
    await expect(
      conformanceOf({
        runner: conformingWith({ outcome: "ok", value: [{ caseName: "two classes", flaggedLines: [1, 3] }] }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("case no class has no single verdict") } });
  });

  it("is runner-invalid-output when two verdicts name the same case", async () => {
    await expect(
      conformanceOf({
        runner: conformingWith({
          outcome: "ok",
          value: [
            { caseName: "two classes", flaggedLines: [1, 3] },
            { caseName: "no class", flaggedLines: [] },
            { caseName: "two classes", flaggedLines: [1, 3] },
          ],
        }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("case two classes has no single verdict") } });
  });

  it("is runner-invalid-output when a verdict names an unknown case", async () => {
    await expect(
      conformanceOf({
        runner: conformingWith({
          outcome: "ok",
          value: [
            { caseName: "two classes", flaggedLines: [1, 3] },
            { caseName: "no class", flaggedLines: [] },
            { caseName: "three classes", flaggedLines: [1] },
          ],
        }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("a verdict names the unknown case three classes") } });
  });

  it("is runner-invalid-output when a verdict flags line 0", async () => {
    await expect(
      conformanceOf({
        runner: conformingWith({
          outcome: "ok",
          value: [
            { caseName: "two classes", flaggedLines: [0, 1, 3] },
            { caseName: "no class", flaggedLines: [] },
          ],
        }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("→ at value[0].flaggedLines[0]") } });
  });

  it("is runner-invalid-output when conform throws synchronously", async () => {
    const runner: LoadedRunner = {
      ...conformingWith({ outcome: "ok", value: [] }),
      conform: vi.fn<LoadedRunner["conform"]>().mockThrow(new Error("the runner threw")),
    };
    await expect(conformanceOf({ runner })).resolves.toMatchObject({
      outcome: "failed",
      error: { kind: "runner-invalid-output", detail: expect.stringContaining("the runner call threw or rejected: the runner threw") },
    });
  });

  it("is runner-invalid-output when conform rejects", async () => {
    const runner: LoadedRunner = {
      ...conformingWith({ outcome: "ok", value: [] }),
      conform: vi.fn<LoadedRunner["conform"]>().mockRejectedValue(new Error("the runner rejected")),
    };
    await expect(conformanceOf({ runner })).resolves.toMatchObject({
      outcome: "failed",
      error: { kind: "runner-invalid-output", detail: expect.stringContaining("the runner call threw or rejected: the runner rejected") },
    });
  });

  it("passes the runner's own failure through unchanged", async () => {
    await expect(
      conformanceOf({
        runner: conformingWith({
          outcome: "failed",
          error: { kind: "piece-invalid", pieceRoot: "/install/mechanisms/audit/CD-14", detail: "no check export" },
        }),
      }),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: "/install/mechanisms/audit/CD-14", detail: "no check export" },
    });
  });
});
