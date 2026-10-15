import { describe, expect, it } from "vitest";
import { identifiersNamedIn, installNamingFindings, namingScopeOf, reachingSpecifiersIn } from "./install-naming.ts";

const TRACKED_PATHS = [
  "plugins/discipline-core/core/check/run-check.ts",
  "plugins/discipline-core/core/check/run-check.test.ts",
  "plugins/discipline-core/core/values/result.ts",
  "plugins/discipline-core/mechanisms/walker/runner/runner.ts",
  "plugins/discipline-core/mechanisms/walker/runner/runner.test.ts",
  "plugins/discipline-core/mechanisms/walker/runner/README.md",
  "plugins/discipline-core/mechanisms/walker/runner/piece-type-packages.json",
  "plugins/discipline-core/mechanisms/walker/CD-14/class-syntax.ts",
  "plugins/discipline-core/mechanisms/eslint/runner/eslint-instance.ts",
  "plugins/discipline-core/rules/CD-14/discipline.json",
  "plugins/discipline-core/rules/CD-15/discipline.json",
  "plugins/discipline-core/tests/probe-rule-set/rules/PD-1/discipline.json",
  "plugins/discipline-core/tests/probe-rule-set/mechanisms/walker/PD-1/no-tmp-files.ts",
  "plugins/discipline-core/vitest.config.ts",
  "plugins/rin/core/check/elsewhere.ts",
];

describe("namingScopeOf", () => {
  it("takes mechanism ids from the install's mechanism folders, each once", () => {
    expect(namingScopeOf({ trackedPaths: TRACKED_PATHS, installRoot: "plugins/discipline-core" }).mechanisms).toEqual([
      "walker",
      "eslint",
    ]);
  });

  it("takes discipline ids from the install's rule folders only, each once", () => {
    expect(namingScopeOf({ trackedPaths: TRACKED_PATHS, installRoot: "plugins/discipline-core" }).disciplines).toEqual([
      "CD-14",
      "CD-15",
    ]);
  });

  it("lists every non-test file under the install's core", () => {
    expect(namingScopeOf({ trackedPaths: TRACKED_PATHS, installRoot: "plugins/discipline-core" }).coreFiles).toEqual([
      "plugins/discipline-core/core/check/run-check.ts",
      "plugins/discipline-core/core/values/result.ts",
    ]);
  });

  it("lists every non-test file under each mechanism's runner folder", () => {
    expect(namingScopeOf({ trackedPaths: TRACKED_PATHS, installRoot: "plugins/discipline-core" }).runnerFiles).toEqual([
      "plugins/discipline-core/mechanisms/walker/runner/runner.ts",
      "plugins/discipline-core/mechanisms/walker/runner/README.md",
      "plugins/discipline-core/mechanisms/walker/runner/piece-type-packages.json",
      "plugins/discipline-core/mechanisms/eslint/runner/eslint-instance.ts",
    ]);
  });
});

describe("identifiersNamedIn", () => {
  it("finds a mechanism id written as a string literal", () => {
    expect(identifiersNamedIn({ text: 'const mechanism = "walker";\n', identifiers: ["walker", "eslint"] })).toEqual([
      "walker",
    ]);
  });

  it("finds a mechanism id inside an import path", () => {
    expect(
      identifiersNamedIn({
        text: 'import { runner } from "../../mechanisms/walker/runner/runner.ts";\n',
        identifiers: ["walker"],
      }),
    ).toEqual(["walker"]);
  });

  it("finds a discipline id inside a clause address", () => {
    expect(identifiersNamedIn({ text: 'const address = "CD-14#class-syntax";\n', identifiers: ["CD-14"] })).toEqual([
      "CD-14",
    ]);
  });

  it("does not match an id inside a longer token", () => {
    expect(identifiersNamedIn({ text: "const walker_count = 1;\n", identifiers: ["walker"] })).toEqual([]);
  });

  it("does not match an id in another letter case", () => {
    expect(identifiersNamedIn({ text: 'const label = "Walker";\n', identifiers: ["walker"] })).toEqual([]);
  });

  it("does not take a longer discipline id for a shorter one", () => {
    expect(identifiersNamedIn({ text: 'const address = "CD-140#x";\n', identifiers: ["CD-14"] })).toEqual([]);
  });

  it("finds nothing in text naming no identifier", () => {
    expect(identifiersNamedIn({ text: "export const run = () => 1;\n", identifiers: ["walker", "CD-14"] })).toEqual([]);
  });

  it("lists each named identifier once in the order given", () => {
    expect(
      identifiersNamedIn({
        text: 'const a = "CD-14";\nconst b = "walker";\nconst c = "CD-14";\n',
        identifiers: ["walker", "eslint", "CD-14"],
      }),
    ).toEqual(["walker", "CD-14"]);
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

  it("finds a type import and a re-export reaching those folders", () => {
    expect(
      reachingSpecifiersIn({
        text: 'import type { Check } from "../mechanisms/x/runner/check.ts";\nexport { rule } from "../rules/X-1/rule.ts";\n',
      }),
    ).toEqual(["../mechanisms/x/runner/check.ts", "../rules/X-1/rule.ts"]);
  });

  it("finds nothing in imports of core's own folders", () => {
    expect(
      reachingSpecifiersIn({
        text: 'import type { Result } from "../values/result.ts";\nimport { z } from "zod";\n',
      }),
    ).toEqual([]);
  });

  it("does not take a string outside an import for a specifier", () => {
    expect(reachingSpecifiersIn({ text: 'const folder = "mechanisms/";\n' })).toEqual([]);
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

describe("installNamingFindings over sources keyed from the install root", () => {
  it("reads ./-prefixed keys under the install root \".\"", () => {
    expect(
      installNamingFindings({
        installRoot: ".",
        sources: {
          "./core/check/run-check.ts": 'const mechanism = "walker";\n',
          "./mechanisms/walker/runner/runner.ts": "export const runner = 1;\n",
        },
        disciplineFiles: { "./rules/CD-14/discipline.json": "{}" },
      }),
    ).toEqual({
      scope: {
        mechanisms: ["walker"],
        disciplines: ["CD-14"],
        coreFiles: ["./core/check/run-check.ts"],
        runnerFiles: ["./mechanisms/walker/runner/runner.ts"],
      },
      coreNaming: [{ file: "./core/check/run-check.ts", named: ["walker"] }],
      runnerNaming: [],
      coreReach: [],
    });
  });
});
