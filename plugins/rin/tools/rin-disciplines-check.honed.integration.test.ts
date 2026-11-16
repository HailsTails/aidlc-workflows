import { afterEach, describe, expect, test } from "vitest";
import { createHermeticGitRepository, type HermeticGitRepository } from "./hermetic-git/index.ts";
import { type DisciplinesCheckOutcome, runDisciplinesCheck } from "./rin-disciplines-check.ts";
import { defaultReviewProcessPort } from "./rin-gates/review-process-port.ts";
import { defaultPathOperations } from "./rin-harness-path-operations.ts";
import { defaultFileKindPort, defaultFileTextPort } from "./rin-harness-sidecar-file-reader.ts";

const CHECK_TIMEOUT_MILLISECONDS = 100_000;

const TEST_TIMEOUT_MILLISECONDS = 150_000;

const pathOperations = defaultPathOperations();

const files = defaultFileTextPort();

const insideRepository = ({
  repository,
  segments,
}: {
  readonly repository: HermeticGitRepository;
  readonly segments: readonly string[];
}): string => pathOperations.join({ segments: [repository.path, ...segments] });

const INSTALLED_HONED = pathOperations.resolve({ segments: [import.meta.dirname, "..", "..", "..", "node_modules", "honed"] });

const CLOCK_SELECTED = `${JSON.stringify({ version: 1, ruleSets: {}, clauses: { "CD-17#clock-sources": "audit" } }, null, 2)}\n`;

const VENDORED_PASSING_CHECK = 'process.stdout.write("verdict: pass\\n");\n';

const created: HermeticGitRepository[] = [];

const consumerWith = ({ clockSource }: { readonly clockSource: string }): HermeticGitRepository => {
  const repository = createHermeticGitRepository({ namePrefix: "rin-honed-consumer-" });
  created.push(repository);
  repository.writeFile({ relativePath: ".gitignore", body: "node_modules/\ntools/\n" });
  repository.writeFile({ relativePath: "disciplines.json", body: CLOCK_SELECTED });
  files.mkdir(insideRepository({ repository, segments: ["src"] }));
  repository.writeFile({ relativePath: "src/clock.ts", body: clockSource });
  repository.commitAll({ message: "consumer" });
  return repository;
};

const linkInstalledHoned = ({ repository }: { readonly repository: HermeticGitRepository }): void => {
  files.mkdir(insideRepository({ repository, segments: ["node_modules"] }));
  files.linkDirectory(INSTALLED_HONED, insideRepository({ repository, segments: ["node_modules", "honed"] }));
};

const writeVendoredCopy = ({ repository }: { readonly repository: HermeticGitRepository }): void => {
  files.mkdir(insideRepository({ repository, segments: ["tools", "discipline-core", "core", "check"] }), { recursive: true });
  repository.writeFile({ relativePath: "tools/discipline-core/core/check/check-command.ts", body: VENDORED_PASSING_CHECK });
};

const writeLegacyPackage = ({ repository }: { readonly repository: HermeticGitRepository }): void => {
  files.mkdir(insideRepository({ repository, segments: ["node_modules", "discipline-core", "core", "check"] }), { recursive: true });
  repository.writeFile({ relativePath: "node_modules/discipline-core/core/check/check-command.js", body: VENDORED_PASSING_CHECK });
};

const checkedOutcome = ({ repository }: { readonly repository: HermeticGitRepository }): DisciplinesCheckOutcome =>
  runDisciplinesCheck({
    request: { checkoutRoot: repository.path, baseRevision: "HEAD" },
    ports: {
      runSync: defaultReviewProcessPort().runSync,
      pathOperations,
      fileKind: defaultFileKindPort(),
      timeoutMilliseconds: CHECK_TIMEOUT_MILLISECONDS,
    },
  });

afterEach(() => {
  created.splice(0).forEach((repository) => {
    repository.dispose();
  });
});

describe("rin's disciplines check against the installed honed release package (CD-47: the pinned package's real verdict is the assertion's subject, so the check runs it with node over a hermetic temporary git repository and removes it afterwards)", () => {
  test(
    "runs hone check from node_modules/honed and carries its failing report",
    () => {
      const repository = consumerWith({ clockSource: "export const startedAt = Date.now();\n" });
      linkInstalledHoned({ repository });

      expect(checkedOutcome({ repository })).toEqual({
        kind: "failed",
        report: "findings (1)\nCD-17#clock-sources audit src/clock.ts:1:0 export const startedAt = Date.now();\nverdict: fail\n",
      });
    },
    TEST_TIMEOUT_MILLISECONDS,
  );

  test(
    "passes once the code complies",
    () => {
      const repository = consumerWith({ clockSource: "export const startedAt = 0;\n" });
      linkInstalledHoned({ repository });

      expect(checkedOutcome({ repository })).toEqual({ kind: "passed" });
    },
    TEST_TIMEOUT_MILLISECONDS,
  );

  test(
    "prefers the honed package to a vendored copy beside it",
    () => {
      const repository = consumerWith({ clockSource: "export const startedAt = Date.now();\n" });
      linkInstalledHoned({ repository });
      writeVendoredCopy({ repository });

      expect(checkedOutcome({ repository })).toMatchObject({ kind: "failed" });
    },
    TEST_TIMEOUT_MILLISECONDS,
  );

  test(
    "runs a vendored copy when no package is installed, and never counts its pass",
    () => {
      const repository = consumerWith({ clockSource: "export const startedAt = 0;\n" });
      writeVendoredCopy({ repository });

      expect(checkedOutcome({ repository })).toMatchObject({
        kind: "unverified",
        reason: expect.stringContaining("passed, but a vendored copy is not a verified install: install the honed package"),
      });
    },
    TEST_TIMEOUT_MILLISECONDS,
  );

  test(
    "names the move to honed when only the old discipline-core package is installed",
    () => {
      const repository = consumerWith({ clockSource: "export const startedAt = 0;\n" });
      writeLegacyPackage({ repository });

      expect(checkedOutcome({ repository })).toMatchObject({
        kind: "unverified",
        reason: expect.stringContaining("is discipline-core, Hone's old name, which rin no longer runs: install the honed package"),
      });
    },
    TEST_TIMEOUT_MILLISECONDS,
  );
});
