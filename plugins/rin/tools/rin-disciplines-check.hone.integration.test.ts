import { afterEach, describe, expect, test } from "vitest";
import { createHermeticGitRepository, type HermeticGitRepository } from "./hermetic-git/index.ts";
import { type DisciplinesCheckOutcome, runDisciplinesCheck } from "./rin-disciplines-check.ts";
import { defaultReviewProcessPort } from "./rin-gates/review-process-port.ts";
import { defaultPathOperations } from "./rin-harness-path-operations.ts";
import { defaultFileKindPort, defaultFileTextPort, defaultSidecarFileReader } from "./rin-harness-sidecar-file-reader.ts";

const CHECK_TIMEOUT_MILLISECONDS = 100_000;

const TEST_TIMEOUT_MILLISECONDS = 150_000;

const pathOperations = defaultPathOperations();

const files = defaultFileTextPort();

const fileKinds = defaultFileKindPort();

const reader = defaultSidecarFileReader();

const insideRepository = ({
  repository,
  segments,
}: {
  readonly repository: HermeticGitRepository;
  readonly segments: readonly string[];
}): string => pathOperations.join({ segments: [repository.path, ...segments] });

const installedPackage = ({ name }: { readonly name: string }): string =>
  pathOperations.resolve({ segments: [import.meta.dirname, "..", "..", "..", "node_modules", ...name.split("/")] });

const CLOCK_SELECTED = `${JSON.stringify({ version: 1, ruleSets: {}, clauses: { "CD-17#clock-sources": "audit" } }, null, 2)}\n`;

const VENDORED_PASSING_CHECK = 'process.stdout.write("verdict: pass\\n");\n';

type ReplacedPackageFixture = {
  readonly name: string;
  readonly checkCommand: string;
  readonly migratingSection: number;
};

const REPLACED_PACKAGE_FIXTURES: readonly ReplacedPackageFixture[] = [
  { name: "discipline-core", checkCommand: "check-command.js", migratingSection: 10 },
  { name: "honed", checkCommand: "tool-command.js", migratingSection: 11 },
];

const created: HermeticGitRepository[] = [];

const consumerWith = ({ clockSource }: { readonly clockSource: string }): HermeticGitRepository => {
  const repository = createHermeticGitRepository({ namePrefix: "rin-hone-consumer-" });
  created.push(repository);
  repository.writeFile({ relativePath: ".gitignore", body: "node_modules/\ntools/\n" });
  repository.writeFile({ relativePath: "disciplines.json", body: CLOCK_SELECTED });
  files.mkdir(insideRepository({ repository, segments: ["src"] }));
  repository.writeFile({ relativePath: "src/clock.ts", body: clockSource });
  repository.commitAll({ message: "consumer" });
  return repository;
};

const copyTree = ({ from, to }: { readonly from: string; readonly to: string }): void => {
  files.mkdir(to, { recursive: true });
  (reader.listDirectory(from) ?? []).forEach((name) => {
    const source = pathOperations.join({ segments: [from, name] });
    const destination = pathOperations.join({ segments: [to, name] });
    if (fileKinds.isDirectory(source)) {
      copyTree({ from: source, to: destination });
      return;
    }
    files.write(destination, files.read(source));
  });
};

const installPackage = ({ repository, name }: { readonly repository: HermeticGitRepository; readonly name: string }): void => {
  copyTree({ from: installedPackage({ name }), to: insideRepository({ repository, segments: ["node_modules", ...name.split("/")] }) });
};

const installHone = ({ repository }: { readonly repository: HermeticGitRepository }): void => {
  installPackage({ repository, name: "@hailstails/hone" });
  installPackage({ repository, name: "typescript" });
};

const writeVendoredCopy = ({ repository }: { readonly repository: HermeticGitRepository }): void => {
  files.mkdir(insideRepository({ repository, segments: ["tools", "discipline-core", "core", "check"] }), { recursive: true });
  repository.writeFile({ relativePath: "tools/discipline-core/core/check/check-command.ts", body: VENDORED_PASSING_CHECK });
};

const writeReplacedPackage = ({
  repository,
  replaced,
}: {
  readonly repository: HermeticGitRepository;
  readonly replaced: ReplacedPackageFixture;
}): void => {
  files.mkdir(insideRepository({ repository, segments: ["node_modules", replaced.name, "core", "check"] }), { recursive: true });
  repository.writeFile({
    relativePath: `node_modules/${replaced.name}/core/check/${replaced.checkCommand}`,
    body: VENDORED_PASSING_CHECK,
  });
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

describe("rin's disciplines check against the installed @hailstails/hone release package (CD-47: the pinned package's real verdict is the assertion's subject, so the check runs it with node over a hermetic temporary git repository and removes it afterwards)", () => {
  test(
    "runs hone check from node_modules/@hailstails/hone and carries its failing report",
    () => {
      const repository = consumerWith({ clockSource: "export const startedAt = Date.now();\n" });
      installHone({ repository });

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
      installHone({ repository });

      expect(checkedOutcome({ repository })).toEqual({ kind: "passed" });
    },
    TEST_TIMEOUT_MILLISECONDS,
  );

  test(
    "prefers the @hailstails/hone package to a vendored copy beside it",
    () => {
      const repository = consumerWith({ clockSource: "export const startedAt = Date.now();\n" });
      installHone({ repository });
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
        reason: expect.stringContaining("passed, but a vendored copy is not a verified install: install the @hailstails/hone package"),
      });
    },
    TEST_TIMEOUT_MILLISECONDS,
  );

  test.each(REPLACED_PACKAGE_FIXTURES)(
    "names the move to @hailstails/hone when only the old $name package is installed",
    (replaced) => {
      const repository = consumerWith({ clockSource: "export const startedAt = 0;\n" });
      writeReplacedPackage({ repository, replaced });

      expect(checkedOutcome({ repository })).toMatchObject({
        kind: "unverified",
        reason: expect.stringContaining(
          `is ${replaced.name}, an old name of Hone, which rin no longer runs: install the @hailstails/hone package in its place as Hone's MIGRATING.md section ${String(replaced.migratingSection)} says`,
        ),
      });
    },
    TEST_TIMEOUT_MILLISECONDS,
  );
});
