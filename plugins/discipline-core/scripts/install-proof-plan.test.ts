import { describe, expect, it } from "vitest";
import {
  CONSUMER_MANIFEST,
  entryDisposition,
  environmentWithoutGit,
  exclusionRules,
  installPlacements,
  judgedStep,
  PROOF_CASES,
  packagedConsumerManifest,
  parsedInstallList,
  type StepExpectation,
  toolchainManifest,
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
  always: ["README.md", "core/", "docs/why-chain-contract.md"],
  intoRoot: ["install/package.json", "install/package-lock.json"],
  perSharedClause: ["rules/<DisciplineId>/", "mechanisms/<MechanismId>/runner/", "mechanisms/<MechanismId>/<DisciplineId>/"],
  leftOut: ["*.test.ts", "tests/", "test-fixtures/"],
};

const README_WITHOUT_SECTION = "# Discipline core\n\n## Runtime\n\n- always: `package.json`\n";

const INTO_ROOT_LINE = "- into the install root: `install/package.json`\n";

const README_WITHOUT_INTO_ROOT_LINE =
  "## Installing\n\n- always: `core/`\n- for each selected clause in the shared rule set: `rules/<DisciplineId>/`\n\nLeave out test files (`*.test.ts`).\n";

const README_WITHOUT_CLAUSE_LINE = `## Installing\n\n- always: \`core/\`\n${INTO_ROOT_LINE}\nLeave out test files (\`*.test.ts\`).\n\n## Runtime\n`;

const README_WITH_LEFT_OUT_IN_NEXT_SECTION = `## Installing\n\n- always: \`core/\`\n${INTO_ROOT_LINE}- for each selected clause in the shared rule set: \`rules/<DisciplineId>/\`\n\n## Runtime\n\nLeave out \`tests/\` folders.\n`;

const README_WITH_TWO_SENTENCES = `## Installing\n\n- always: \`core/\`\n${INTO_ROOT_LINE}- for each selected clause in the shared rule set: \`rules/<DisciplineId>/\`\n\nLeave out test files (\`*.test.ts\`) and \`tests/\` folders. The install must not sit under a \`node_modules\` path.\n`;

const UNKNOWN_PLACEHOLDER_LIST = { always: ["core/"], intoRoot: [], perSharedClause: ["rules/<RuleSet>/"], leftOut: [] };

const RULES = exclusionRules({ leftOut: README_INSTALL_LIST.leftOut });

const CONTAINS_FAIL: StepExpectation = { exitCode: 1, output: { kind: "contains", text: "verdict: fail" } };

const EMPTY_OUTPUT: StepExpectation = { exitCode: 0, output: { kind: "empty" } };

describe("parsedInstallList, over this package's README.md read as a build-time raw module (CD-47: the README's own install list is the assertion's subject; nothing is spawned or written)", () => {
  it("reads the always, into-root, shared-clause and left-out lists from § Installing", () => {
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

  it("fails naming the into-root line when it is missing", () => {
    expect(parsedInstallList({ readme: README_WITHOUT_INTO_ROOT_LINE })).toEqual({
      outcome: "failed",
      error: { kind: "line-missing", prefix: "- into the install root: " },
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
      value: {
        always: ["core/"],
        intoRoot: ["install/package.json"],
        perSharedClause: ["rules/<DisciplineId>/"],
        leftOut: ["*.test.ts", "tests/"],
      },
    });
  });
});

describe("installPlacements", () => {
  it("places each path at its own relative path, the discipline and mechanism substituted, and each into-root file at the install root", () => {
    expect(installPlacements({ installList: README_INSTALL_LIST, disciplineId: "CD-14", mechanism: "eslint" })).toEqual({
      outcome: "ok",
      value: [
        { from: "README.md", to: "README.md" },
        { from: "core", to: "core" },
        { from: "docs/why-chain-contract.md", to: "docs/why-chain-contract.md" },
        { from: "install/package.json", to: "package.json" },
        { from: "install/package-lock.json", to: "package-lock.json" },
        { from: "rules/CD-14", to: "rules/CD-14" },
        { from: "mechanisms/eslint/runner", to: "mechanisms/eslint/runner" },
        { from: "mechanisms/eslint/CD-14", to: "mechanisms/eslint/CD-14" },
      ],
    });
  });

  it("fails on a placeholder it does not know", () => {
    expect(installPlacements({ installList: UNKNOWN_PLACEHOLDER_LIST, disciplineId: "CD-14", mechanism: "audit" })).toEqual({
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

const manifestText = (request: { readonly devDependencies: Readonly<Record<string, string>> }): string =>
  `${JSON.stringify({ private: true, devDependencies: request.devDependencies }, null, 2)}\n`;

const FLOOR_ESLINT_PEERS = {
  typescript: "4.8.4",
  "@typescript-eslint/parser": "8.56.0",
  "@typescript-eslint/eslint-plugin": "8.56.0",
};

describe("toolchainManifest, over this package's own package.json read as a build-time raw module", () => {
  it("gives the TypeScript floor root only typescript, at its floor pin installed under its own name", () => {
    expect(toolchainManifest({ developmentManifest: packageFiles["../package.json"], toolchain: "typescript-floor" })).toEqual({
      outcome: "ok",
      value: manifestText({ devDependencies: { typescript: "4.8.4" } }),
    });
  });

  it.each([
    { toolchain: "eslint-9-floor", eslint: "9.12.0" },
    { toolchain: "eslint-10-floor", eslint: "10.0.0" },
  ] as const)("gives the $toolchain root every peer at its floor pin, ESLint at $eslint", ({ toolchain, eslint }) => {
    expect(toolchainManifest({ developmentManifest: packageFiles["../package.json"], toolchain })).toEqual({
      outcome: "ok",
      value: manifestText({ devDependencies: { ...FLOOR_ESLINT_PEERS, eslint } }),
    });
  });

  it("fails on a manifest that is not JSON", () => {
    expect(toolchainManifest({ developmentManifest: "{", toolchain: "typescript-floor" }).outcome).toBe("failed");
  });

  it("fails naming a peer whose floor has no development pin", () => {
    expect(
      toolchainManifest({
        developmentManifest: '{ "peerDependencies": { "typescript": ">=4.8.4 <7.0.0" }, "devDependencies": {} }',
        toolchain: "typescript-floor",
      }),
    ).toEqual({ outcome: "failed", error: { kind: "manifest-invalid", detail: "no development pin typescript-floor for the peer typescript" } });
  });

  it("fails when a floor pin aliases a different package than the peer it stands for", () => {
    expect(
      toolchainManifest({
        developmentManifest: '{ "peerDependencies": { "typescript": ">=4.8.4 <7.0.0" }, "devDependencies": { "typescript-floor": "npm:typescript-legacy@4.8.4" } }',
        toolchain: "typescript-floor",
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "manifest-invalid", detail: "the development pin typescript-floor is npm:typescript-legacy@4.8.4, not an alias of typescript" },
    });
  });

  it("fails when a pinned package is not a declared peer", () => {
    expect(
      toolchainManifest({
        developmentManifest: '{ "peerDependencies": {}, "devDependencies": { "typescript-floor": "npm:typescript@4.8.4" } }',
        toolchain: "typescript-floor",
      }),
    ).toEqual({ outcome: "failed", error: { kind: "manifest-invalid", detail: "typescript is not a declared peer" } });
  });
});

const expectationsOf = (consumer: string) =>
  PROOF_CASES.find((proofCase) => proofCase.consumer === consumer)?.actions.filter((action) => action.kind !== "read");

describe("the proof cases", () => {
  it("cover, on the copy route, an audit-only consumer, an ESLint consumer on each line's floor, one missing eslint and one missing the installed manifest, and the same first four on the package route, over three shared toolchains", () => {
    expect(PROOF_CASES.map((proofCase) => [proofCase.consumer, proofCase.route, proofCase.toolchain])).toEqual([
      ["audit", "copy", "typescript-floor"],
      ["eslint-10", "copy", "eslint-10-floor"],
      ["eslint-9", "copy", "eslint-9-floor"],
      ["eslint-missing", "copy", "typescript-floor"],
      ["no-package-json", "copy", "typescript-floor"],
      ["audit-package", "package", "typescript-floor"],
      ["eslint-10-package", "package", "eslint-10-floor"],
      ["eslint-9-package", "package", "eslint-9-floor"],
      ["eslint-missing-package", "package", "typescript-floor"],
    ]);
  });

  it("assert the same command expectations on the package route as on the copy route, plus the projection's package import", () => {
    expect([
      expectationsOf("audit-package"),
      expectationsOf("eslint-10-package"),
      expectationsOf("eslint-9-package"),
      expectationsOf("eslint-missing-package"),
      PROOF_CASES.find((proofCase) => proofCase.consumer === "eslint-10-package")?.actions.find((action) => action.kind === "read"),
    ]).toEqual([
      expectationsOf("audit"),
      expectationsOf("eslint-10"),
      expectationsOf("eslint-9"),
      expectationsOf("eslint-missing"),
      {
        kind: "read",
        path: "disciplines.eslint.mjs",
        contains: 'import piece0 from "discipline-core/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.js";',
      },
    ]);
  });

  it("give a packaged consumer scripts calling the two bins on the repository root", () => {
    expect(packagedConsumerManifest({ identity: { name: "core", checkBin: "core-check", projectBin: "core-project" } })).toBe(
      `${JSON.stringify(
        { private: true, type: "commonjs", scripts: { "discipline:check": "core-check --repo .", "discipline:project": "core-project --repo ." } },
        null,
        2,
      )}\n`,
    );
  });

  it("give each consumer a commonjs manifest with no dependencies of its own", () => {
    expect(CONSUMER_MANIFEST).toBe(`${JSON.stringify({ private: true, type: "commonjs" }, null, 2)}\n`);
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
