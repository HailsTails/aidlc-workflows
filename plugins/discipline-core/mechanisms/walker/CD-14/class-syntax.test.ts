import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import { createPathPort, posixPathFlavour } from "../../../core/platform-ports/path-port.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import discipline from "../../../rules/CD-14/discipline.json" with { type: "json" };
import { createWalkerRunner } from "../runner/create-walker-runner.ts";
import { createDefaultParsePort } from "../runner/typescript-parse.ts";
import { check } from "./class-syntax.ts";

const CLASS_ON_LINE_THREE = "const a = 1;\n\n  class Alpha {}\n";
const ADDRESS = clauseAddressSchema.parse("CD-14#class-syntax");

const sharedCaseSchema = z.object({
  name: z.string(),
  fileName: repoPathSchema,
  source: z.string(),
  expectedLines: z.array(z.number()),
});

const sharedCases = z
  .object({
    clauses: z.tuple([
      z.object({
        cases: z.object({ flag: z.array(sharedCaseSchema), allow: z.array(sharedCaseSchema) }),
      }),
      z.object({ kind: z.literal("judgement") }),
    ]),
  })
  .parse(discipline).clauses[0].cases;

const CLAUSE: RunnerClause = {
  address: ADDRESS,
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: "/install/mechanisms/walker/CD-14",
  settings: { module: "class-syntax.ts" },
};

const sourceOnLineThree: FileTextPort = {
  read: () => ({ outcome: "ok", value: CLASS_ON_LINE_THREE }),
  exists: () => "present",
  write: () => ({ outcome: "ok", value: undefined }),
};

const loadingThisPiece: ModuleLoaderPort = {
  load: () => Promise.resolve({ outcome: "ok", value: { check } }),
};

const walkerRunner = createWalkerRunner({
  fileText: sourceOnLineThree,
  modules: loadingThisPiece,
  path: createPathPort({ flavour: posixPathFlavour, workingDirectory: () => "/install" }),
  parse: createDefaultParsePort({}),
});

describe("CD-14 class-syntax walker check over TypeScript's own parse", () => {
  it.each([
    ...sharedCases.flag,
    ...sharedCases.allow,
  ])("flags exactly the expected lines of the shared case $name", async (sharedCase) => {
    expect(await walkerRunner.conform({ clause: CLAUSE, cases: [sharedCase] })).toEqual({
      outcome: "ok",
      value: [{ caseName: sharedCase.name, flaggedLines: sharedCase.expectedLines }],
    });
  });

  it("anchors a class on line 3 at its class keyword, as the fake-port runner test does", async () => {
    expect(
      await walkerRunner.run({
        repoRoot: absolutePathSchema.parse("/repo"),
        installRoot: absolutePathSchema.parse("/install"),
        files: [repoPathSchema.parse("src/alpha.ts")],
        trackedPaths: [],
        clauses: [CLAUSE],
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          clause: ADDRESS,
          file: "src/alpha.ts",
          anchor: { line: 3, column: 2 },
          snippet: "class Alpha {}",
        },
      ],
    });
  });
});
