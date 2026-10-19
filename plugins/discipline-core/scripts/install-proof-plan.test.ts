import { describe, expect, it } from "vitest";
import {
  consumerRootManifest,
  entryDisposition,
  environmentWithoutGit,
  exclusionRules,
  installPaths,
  judgedStep,
  parsedInstallList,
  type StepExpectation,
} from "./install-proof-plan.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const packageFiles = import.meta.glob(["../README.md", "../package.json"], {
  base: "./",
  query: "?raw",
  import: "default",
  eager: true,
});

const README_INSTALL_LIST = {
  always: ["package.json", "core/"],
  perSharedClause: ["rules/<DisciplineId>/", "mechanisms/<MechanismId>/runner/", "mechanisms/<MechanismId>/<DisciplineId>/"],
  leftOut: ["*.test.ts", "tests/", "test-fixtures/"],
};

const README_WITHOUT_SECTION = "# Discipline core\n\n## Runtime\n\n- always: `package.json`\n";

const README_WITHOUT_CLAUSE_LINE =
  "## Installing\n\n- always: `package.json` and `core/`\n\nLeave out test files (`*.test.ts`).\n\n## Runtime\n";

const README_WITH_LEFT_OUT_IN_NEXT_SECTION =
  "## Installing\n\n- always: `package.json` and `core/`\n- for each selected clause in the shared rule set: `rules/<DisciplineId>/`\n\n## Runtime\n\nLeave out `tests/` folders.\n";

const README_WITH_TWO_SENTENCES =
  "## Installing\n\n- always: `package.json`\n- for each selected clause in the shared rule set: `rules/<DisciplineId>/`\n\nLeave out test files (`*.test.ts`) and `tests/` folders. The install must not sit under a `node_modules` path.\n";

const UNKNOWN_PLACEHOLDER_LIST = { always: ["core/"], perSharedClause: ["rules/<RuleSet>/"], leftOut: [] };

const RULES = exclusionRules({ leftOut: README_INSTALL_LIST.leftOut });

const CONTAINS_FAIL: StepExpectation = { exitCode: 1, output: { kind: "contains", text: "verdict: fail" } };

const EMPTY_OUTPUT: StepExpectation = { exitCode: 0, output: { kind: "empty" } };

describe("parsedInstallList, over this package's README.md read as a build-time raw module (CD-47: the README's own install list is the assertion's subject; nothing is spawned or written)", () => {
  it("reads the always, shared-clause and left-out lists from § Installing", () => {
    expect(parsedInstallList({ readme: packageFiles["../README.md"] })).toEqual({
      outcome: "ok",
      value: README_INSTALL_LIST,
    });
  });

  it("fails when the Installing section is missing", () => {
    expect(parsedInstallList({ readme: README_WITHOUT_SECTION })).toEqual({
      outcome: "failed",
      error: { kind: "section-missing", heading: "## Installing" },
    });
  });

  it("fails naming the shared-clause line when it is missing", () => {
    expect(parsedInstallList({ readme: README_WITHOUT_CLAUSE_LINE })).toEqual({
      outcome: "failed",
      error: { kind: "line-missing", prefix: "- for each selected clause in the shared rule set: " },
    });
  });

  it("does not read a Leave out sentence from a later section", () => {
    expect(parsedInstallList({ readme: README_WITH_LEFT_OUT_IN_NEXT_SECTION })).toEqual({
      outcome: "failed",
      error: { kind: "line-missing", prefix: "Leave out " },
    });
  });

  it("reads left-out names from the first sentence only", () => {
    expect(parsedInstallList({ readme: README_WITH_TWO_SENTENCES })).toEqual({
      outcome: "ok",
      value: { always: ["package.json"], perSharedClause: ["rules/<DisciplineId>/"], leftOut: ["*.test.ts", "tests/"] },
    });
  });
});

describe("installPaths", () => {
  it("substitutes the discipline and mechanism into concrete relative paths", () => {
    expect(installPaths({ installList: README_INSTALL_LIST, disciplineId: "CD-14", mechanism: "eslint" })).toEqual({
      outcome: "ok",
      value: ["package.json", "core", "rules/CD-14", "mechanisms/eslint/runner", "mechanisms/eslint/CD-14"],
    });
  });

  it("fails on a placeholder it does not know", () => {
    expect(installPaths({ installList: UNKNOWN_PLACEHOLDER_LIST, disciplineId: "CD-14", mechanism: "audit" })).toEqual({
      outcome: "failed",
      error: { kind: "unresolved-placeholder", path: "rules/<RuleSet>/" },
    });
  });
});

describe("entryDisposition, over the README's left-out names", () => {
  it("leaves out a test file", () => {
    expect(entryDisposition({ rules: RULES, name: "runner.test.ts", entryKind: "file" })).toBe("left-out");
  });

  it("leaves out a tests folder", () => {
    expect(entryDisposition({ rules: RULES, name: "tests", entryKind: "folder" })).toBe("left-out");
  });

  it("leaves out a test-fixtures folder", () => {
    expect(entryDisposition({ rules: RULES, name: "test-fixtures", entryKind: "folder" })).toBe("left-out");
  });

  it("keeps a file named like a left-out folder", () => {
    expect(entryDisposition({ rules: RULES, name: "tests", entryKind: "file" })).toBe("kept");
  });

  it("keeps a runtime module", () => {
    expect(entryDisposition({ rules: RULES, name: "runner.ts", entryKind: "file" })).toBe("kept");
  });

  it("leaves out a file listed by its exact name", () => {
    expect(entryDisposition({ rules: exclusionRules({ leftOut: ["LICENSE"] }), name: "LICENSE", entryKind: "file" })).toBe("left-out");
  });
});

describe("judgedStep", () => {
  it("passes on the expected exit and a line containing the expected text", () => {
    expect(
      judgedStep({ label: "audit check", expectation: CONTAINS_FAIL, run: { outcome: "exited", exitCode: 1, output: "x\nverdict: fail\n" } }),
    ).toEqual({ outcome: "ok", value: 'ok: audit check -> exit 1, "verdict: fail"' });
  });

  it("fails on an exit mismatch, carrying the captured output", () => {
    expect(
      judgedStep({ label: "audit check", expectation: CONTAINS_FAIL, run: { outcome: "exited", exitCode: 0, output: "verdict: fail\n" } }),
    ).toEqual({ outcome: "failed", error: 'FAIL: audit check: expected exit 1 and "verdict: fail", got exit 0\nverdict: fail\n' });
  });

  it("fails when the expected text is missing", () => {
    expect(
      judgedStep({ label: "audit check", expectation: CONTAINS_FAIL, run: { outcome: "exited", exitCode: 1, output: "verdict: pass\n" } }),
    ).toEqual({ outcome: "failed", error: 'FAIL: audit check: expected exit 1 and "verdict: fail", got exit 1\nverdict: pass\n' });
  });

  it("passes an empty-output expectation on no output", () => {
    expect(judgedStep({ label: "audit project", expectation: EMPTY_OUTPUT, run: { outcome: "exited", exitCode: 0, output: "" } })).toEqual({
      outcome: "ok",
      value: 'ok: audit project -> exit 0, ""',
    });
  });

  it("fails an empty-output expectation on any output", () => {
    expect(
      judgedStep({ label: "audit project", expectation: EMPTY_OUTPUT, run: { outcome: "exited", exitCode: 0, output: "a written\n" } }),
    ).toEqual({ outcome: "failed", error: 'FAIL: audit project: expected exit 0 and "", got exit 0\na written\n' });
  });

  it("fails a run that did not exit", () => {
    expect(judgedStep({ label: "audit project", expectation: EMPTY_OUTPUT, run: { outcome: "not-exited", detail: "spawn ENOENT" } })).toEqual({
      outcome: "failed",
      error: 'FAIL: audit project: expected exit 0 and "", but it did not exit: spawn ENOENT',
    });
  });
});

describe("consumerRootManifest", () => {
  it("carries this package's own dependencies, read as a build-time raw module", () => {
    expect(consumerRootManifest({ packageManifest: packageFiles["../package.json"] })).toEqual({
      outcome: "ok",
      value: `${JSON.stringify(
        {
          private: true,
          dependencies: {
            "@eslint/plugin-kit": "0.7.3",
            "@typescript-eslint/parser": "8.71.2",
            eslint: "10.11.0",
            "jsonc-parser": "3.3.1",
            typescript: "6.0.3",
            zod: "4.4.3",
          },
        },
        null,
        2,
      )}\n`,
    });
  });

  it("fails on a manifest that is not JSON", () => {
    expect(consumerRootManifest({ packageManifest: "{" }).outcome).toBe("failed");
  });

  it("fails on a manifest without dependencies", () => {
    expect(consumerRootManifest({ packageManifest: '{ "name": "x" }' }).outcome).toBe("failed");
  });
});

describe("environmentWithoutGit", () => {
  it("removes every GIT_ variable and keeps the rest", () => {
    expect(environmentWithoutGit({ environment: { GIT_DIR: "/x", GIT_INDEX_FILE: "/y", PATH: "/bin", HOME: "/h" } })).toEqual({
      PATH: "/bin",
      HOME: "/h",
    });
  });
});
