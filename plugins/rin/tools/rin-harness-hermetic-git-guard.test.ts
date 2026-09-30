import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  MINIMUM_EXPECTED_TEST_FILES,
  runGuard,
} from "./rin-harness-hermetic-git-guard.ts";

const runGuardOverFixture = ({ projectDir }: { readonly projectDir: string }) =>
  runGuard({ projectDir, minimumExpectedTestFiles: 0 });

const created: string[] = [];

const newProject = (): string => {
  const projectDir = mkdtempSync(join(tmpdir(), "hermetic-guard-"));
  created.push(projectDir);
  return projectDir;
};

const writeProjectFile = ({
  projectDir,
  relativePath,
  body,
}: {
  readonly projectDir: string;
  readonly relativePath: string;
  readonly body: string;
}): void => {
  const absolute = join(projectDir, relativePath);
  mkdirSync(join(absolute, ".."), { recursive: true });
  writeFileSync(absolute, body);
};

afterEach(() => {
  created.splice(0).forEach((projectDir) => {
    rmSync(projectDir, { recursive: true, force: true });
  });
});

describe("runGuard", () => {
  test("flags a test file spawning git with an inherited environment", () => {
    const projectDir = newProject();
    writeProjectFile({
      projectDir,
      relativePath: "offender.test.ts",
      body: 'execFileSync("git", ["init"], { cwd: root });\n',
    });

    expect(runGuardOverFixture({ projectDir }).findings).toHaveLength(1);
  });

  test("reports the offending line number", () => {
    const projectDir = newProject();
    writeProjectFile({
      projectDir,
      relativePath: "offender.test.ts",
      body: 'const a = 1;\nspawnSync("git", ["status"]);\n',
    });

    expect(runGuardOverFixture({ projectDir }).findings[0]?.line).toBe(2);
  });

  test("accepts a git spawn that passes an explicit environment", () => {
    const projectDir = newProject();
    writeProjectFile({
      projectDir,
      relativePath: "compliant.test.ts",
      body: 'execFileSync("git", ["init"], {\n  cwd: repository.path,\n  env: repository.environment,\n});\n',
    });

    expect(runGuardOverFixture({ projectDir }).pass).toBe(true);
  });

  test("flags a spawn whose env is the ambient process environment", () => {
    const projectDir = newProject();
    writeProjectFile({
      projectDir,
      relativePath: "ambient.test.ts",
      body: 'execFileSync("git", ["init"], {\n  cwd: root,\n  env: process.env,\n});\n',
    });

    expect(runGuardOverFixture({ projectDir }).findings).toHaveLength(1);
  });

  test("flags a spawn whose env spreads the ambient process environment", () => {
    const projectDir = newProject();
    writeProjectFile({
      projectDir,
      relativePath: "spread.test.ts",
      body: 'execFileSync("git", ["init"], {\n  env: { ...process.env, GIT_DIR: undefined },\n});\n',
    });

    expect(runGuardOverFixture({ projectDir }).findings).toHaveLength(1);
  });

  test("flags a spawn whose options lie beyond the inspected span", () => {
    const projectDir = newProject();
    writeProjectFile({
      projectDir,
      relativePath: "distant.test.ts",
      body: `execFileSync("git", ["init"], {\n${"  filler: 0,\n".repeat(10)}  env: repository.environment,\n});\n`,
    });

    expect(runGuardOverFixture({ projectDir }).findings).toHaveLength(1);
  });

  test("flags an unrelated env key on a nearby line", () => {
    const projectDir = newProject();
    writeProjectFile({
      projectDir,
      relativePath: "nearby.test.ts",
      body: 'execFileSync("git", ["init"], { cwd: root });\nspawnSync("node", [], { env: other });\n',
    });

    expect(runGuardOverFixture({ projectDir }).findings).toHaveLength(1);
  });

  test("flags an ambient spawn in a file that elsewhere imports the helper", () => {
    const projectDir = newProject();
    writeProjectFile({
      projectDir,
      relativePath: "partial.test.ts",
      body: 'import { createHermeticGitRepository } from "../hermetic-git/index.ts";\nconst repository = createHermeticGitRepository({});\nexecFileSync("git", ["init"], { cwd: other });\n',
    });

    expect(runGuardOverFixture({ projectDir }).findings).toHaveLength(1);
  });

  test("scans .mjs test files the constitution walker cannot reach", () => {
    const projectDir = newProject();
    writeProjectFile({
      projectDir,
      relativePath: "offender.test.mjs",
      body: 'execFileSync("git", ["init"]);\n',
    });

    expect(runGuardOverFixture({ projectDir }).findings).toHaveLength(1);
  });

  test("scans test files nested under a .claude directory", () => {
    const projectDir = newProject();
    writeProjectFile({
      projectDir,
      relativePath: join(".claude", "hooks", "offender.test.ts"),
      body: 'execFileSync("git", ["init"]);\n',
    });

    expect(runGuardOverFixture({ projectDir }).findings).toHaveLength(1);
  });

  test("ignores production files that are not tests", () => {
    const projectDir = newProject();
    writeProjectFile({
      projectDir,
      relativePath: "production.ts",
      body: 'execFileSync("git", ["init"]);\n',
    });

    expect(runGuardOverFixture({ projectDir }).findings).toEqual([]);
  });

  test("ignores a spawn of a command other than git", () => {
    const projectDir = newProject();
    writeProjectFile({
      projectDir,
      relativePath: "other.test.ts",
      body: 'execFileSync("node", ["script.mjs"]);\n',
    });

    expect(runGuardOverFixture({ projectDir }).findings).toEqual([]);
  });

  test("does not descend into node_modules", () => {
    const projectDir = newProject();
    writeProjectFile({
      projectDir,
      relativePath: join("node_modules", "dep", "vendored.test.ts"),
      body: 'execFileSync("git", ["init"]);\n',
    });

    expect(runGuardOverFixture({ projectDir }).findings).toEqual([]);
  });

  test("does not descend into .claude/worktrees while still scanning live source", () => {
    const projectDir = newProject();
    writeProjectFile({
      projectDir,
      relativePath: join(
        ".claude",
        "worktrees",
        "some-slice",
        ".claude",
        "hooks",
        "vendored.test.ts",
      ),
      body: 'execFileSync("git", ["init"]);\n',
    });
    writeProjectFile({
      projectDir,
      relativePath: join(".claude", "hooks", "live.test.ts"),
      body: 'execFileSync("git", ["status"]);\n',
    });

    const outcome = runGuardOverFixture({ projectDir });

    expect(outcome.findings.map((finding) => finding.file)).toEqual([
      ".claude/hooks/live.test.ts",
    ]);
  });

  test("suppresses a finding listed in the allowance file", () => {
    const projectDir = newProject();
    writeProjectFile({
      projectDir,
      relativePath: "offender.test.ts",
      body: 'execFileSync("git", ["init"]);\n',
    });
    writeProjectFile({
      projectDir,
      relativePath: ".hermetic-git-allowances.json",
      body: JSON.stringify([
        { file: "offender.test.ts", reason: "structural" },
      ]),
    });

    expect(runGuardOverFixture({ projectDir }).findings).toEqual([]);
  });

  test("ignores an allowance carrying no reason", () => {
    const projectDir = newProject();
    writeProjectFile({
      projectDir,
      relativePath: "offender.test.ts",
      body: 'execFileSync("git", ["init"]);\n',
    });
    writeProjectFile({
      projectDir,
      relativePath: ".hermetic-git-allowances.json",
      body: JSON.stringify([{ file: "offender.test.ts" }]),
    });

    expect(runGuardOverFixture({ projectDir }).findings).toHaveLength(1);
  });

  test("fails an allowance that no longer suppresses anything", () => {
    const projectDir = newProject();
    writeProjectFile({
      projectDir,
      relativePath: ".hermetic-git-allowances.json",
      body: JSON.stringify([
        { file: "already-fixed.test.ts", reason: "structural" },
      ]),
    });

    expect(runGuardOverFixture({ projectDir }).staleAllowances).toEqual([
      "already-fixed.test.ts",
    ]);
  });

  test("finds no offender in a project with no test files at all", () => {
    expect(runGuardOverFixture({ projectDir: newProject() }).findings).toEqual(
      [],
    );
  });

  test("fails a scan that collapses below the expected test-file floor", () => {
    const outcome = runGuard({
      projectDir: newProject(),
      minimumExpectedTestFiles: 1,
    });

    expect(outcome.breachesScanFloor).toBe(true);
    expect(outcome.pass).toBe(false);
  });

  test("passes a scan that reaches the expected test-file floor", () => {
    const projectDir = newProject();
    writeProjectFile({
      projectDir,
      relativePath: "compliant.test.ts",
      body: 'execFileSync("node", ["script.mjs"]);\n',
    });

    const outcome = runGuard({ projectDir, minimumExpectedTestFiles: 1 });

    expect(outcome.breachesScanFloor).toBe(false);
    expect(outcome.pass).toBe(true);
  });

  test("guards the real repository with a non-zero scan floor", () => {
    expect(MINIMUM_EXPECTED_TEST_FILES).toBeGreaterThan(0);
  });
});
