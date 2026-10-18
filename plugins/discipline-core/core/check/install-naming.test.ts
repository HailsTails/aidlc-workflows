import { describe, expect, it } from "vitest";
import { identifiersNamedIn, installNamingFindings, reachingSpecifiersIn } from "./install-naming.ts";

describe("identifiersNamedIn", () => {
  it("finds a mechanism id written as a string literal", () => {
    expect(identifiersNamedIn({ text: 'const mechanism = "walker";\n', identifiers: ["walker", "eslint"] })).toEqual([
      "walker",
    ]);
  });

  it("does not match an id inside a longer token", () => {
    expect(identifiersNamedIn({ text: "const walker_count = 1;\n", identifiers: ["walker"] })).toEqual([]);
  });

  it("does not take a longer discipline id for a shorter one", () => {
    expect(identifiersNamedIn({ text: 'const address = "CD-140#x";\n', identifiers: ["CD-14"] })).toEqual([]);
  });
});

describe("reachingSpecifiersIn", () => {
  it("finds an import specifier reaching a mechanism folder", () => {
    expect(
      reachingSpecifiersIn({ text: 'import { runner } from "../../mechanisms/walker/runner/runner.ts";\n' }),
    ).toEqual(["../../mechanisms/walker/runner/runner.ts"]);
  });

  it("finds an import specifier reaching a rules folder", () => {
    expect(
      reachingSpecifiersIn({
        text: 'import discipline from "../../rules/CD-14/discipline.json" with { type: "json" };\n',
      }),
    ).toEqual(["../../rules/CD-14/discipline.json"]);
  });

  it("finds nothing in imports of core's own folders", () => {
    expect(
      reachingSpecifiersIn({
        text: 'import type { Result } from "../values/result.ts";\nimport { z } from "zod";\n',
      }),
    ).toEqual([]);
  });
});

const RUN_CHECK_KEY = "../../core/check/run-check.ts";
const RUNNER_KEY = "../../mechanisms/walker/runner/runner.ts";

describe("installNamingFindings", () => {
  it("reports a core file naming a mechanism, a runner naming a discipline and a core import reaching a runner", () => {
    expect(
      installNamingFindings({
        installRoot: "../..",
        sources: {
          [RUN_CHECK_KEY]: 'import { runner } from "../../mechanisms/walker/runner/runner.ts";\n',
          [RUNNER_KEY]: 'const address = "CD-14#class-syntax";\n',
        },
        disciplineFiles: { "../../rules/CD-14/discipline.json": "{}" },
      }),
    ).toEqual({
      scope: {
        mechanisms: ["walker"],
        disciplines: ["CD-14"],
        coreFiles: [RUN_CHECK_KEY],
        runnerFiles: [RUNNER_KEY],
      },
      coreNaming: [{ file: RUN_CHECK_KEY, named: ["walker"] }],
      runnerNaming: [{ file: RUNNER_KEY, named: ["CD-14"] }],
      coreReach: [{ file: RUN_CHECK_KEY, specifiers: ["../../mechanisms/walker/runner/runner.ts"] }],
    });
  });

  it("does not report a runner file naming its own mechanism", () => {
    expect(
      installNamingFindings({
        installRoot: "../..",
        sources: {
          [RUN_CHECK_KEY]: "export const run = 1;\n",
          [RUNNER_KEY]: 'const mechanism = "walker";\n',
        },
        disciplineFiles: { "../../rules/CD-14/discipline.json": "{}" },
      }),
    ).toMatchObject({ coreNaming: [], runnerNaming: [], coreReach: [] });
  });
});
