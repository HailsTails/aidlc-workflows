import { spawnSync } from "node:child_process";
import { mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import {
  createHermeticGitRepository,
  type HermeticGitRepository,
} from "./hermetic-git/index.ts";
import { changedFiles } from "./rin-harness-carve-out-decay.ts";

const TOOL_PATH = fileURLToPath(
  new URL("./rin-harness-carve-out-decay.ts", import.meta.url),
);

const createdRepositories: HermeticGitRepository[] = [];

const newRepo = (): HermeticGitRepository => {
  const repository = createHermeticGitRepository({
    namePrefix: "rin-carve-decay-",
  });
  createdRepositories.push(repository);
  repository.run(["config", "core.autocrlf", "false"]);
  repository.writeFile({ relativePath: "seed.txt", body: "seed\n" });
  repository.commitAll({ message: "seed" });
  return repository;
};

afterEach(() => {
  createdRepositories.splice(0).forEach((repository) => {
    repository.dispose();
  });
});

describe("changedFiles", () => {
  test("returns a success result with the untracked file set when git resolves the base ref", () => {
    const repository = newRepo();
    repository.writeFile({ relativePath: "added.txt", body: "new\n" });

    const result = changedFiles(repository.path, "HEAD");

    expect(result.result).toBe("success");
    expect(result.result === "success" && result.files).toContain("added.txt");
  });

  test("returns an empty success result when the diff range is legitimately empty", () => {
    const repository = newRepo();

    const result = changedFiles(repository.path, "HEAD");

    expect(result).toEqual({ result: "success", files: [] });
  });

  test("returns a failure result naming the failing args when the base ref is unresolvable", () => {
    const repository = newRepo();

    const result = changedFiles(repository.path, "origin/main");

    expect(result.result).toBe("failure");
    expect(result.result === "failure" && result.failure.args).toContain(
      "origin/main...HEAD",
    );
  });
});

const carvedRepo = (): HermeticGitRepository => {
  const repository = newRepo();
  repository.writeFile({ relativePath: "legacy.ts", body: "export const legacy = 1;\n" });
  mkdirSync(join(repository.path, ".constitution-carve-outs"));
  repository.writeFile({ relativePath: ".constitution-carve-outs/cd-7.json", body: JSON.stringify([
    { files: ["legacy.ts"], reason: "Imported historical exception", decision: "legacy-import" },
  ]) });
  repository.commitAll({ message: "legacy baseline" });
  return repository;
};

describe("carve-out-decay CLI fail-closed", () => {
  const runCli = (
    repository: HermeticGitRepository,
    args: readonly string[],
  ): { status: number; stdout: string } => {
    const execution = spawnSync("bun", [TOOL_PATH, "--project-dir", repository.path, ...args], {
      cwd: repository.path,
      env: { ...repository.environment },
      encoding: "utf-8",
    });
    return { status: execution.status ?? -1, stdout: execution.stdout ?? "" };
  };

  test("untouched initial legacy carve-outs need no Five Whys", () => {
    const repository = carvedRepo();
    const outcome = runCli(repository, ["--json"]);
    expect(outcome.status).toBe(0);
    expect(JSON.parse(outcome.stdout)).toMatchObject({ pass: true, findings_count: 0 });
  });

  test("ordinary CLI JSON keeps blocking on a touched carve-out", () => {
    const repository = carvedRepo();
    repository.writeFile({ relativePath: "legacy.ts", body: "export const legacy = 2;\n" });
    const outcome = runCli(repository, ["--json"]);
    expect(outcome.status).toBe(1);
    expect(JSON.parse(outcome.stdout)).toMatchObject({ pass: false, findings_count: 1 });
  });

  test("dispatcher arguments produce evaluated JSON findings with exit zero", () => {
    const repository = carvedRepo();
    repository.writeFile({ relativePath: "legacy.ts", body: "export const legacy = 2;\n" });
    const outcome = runCli(repository, ["--stage", "probe", "--output-path", "legacy.ts"]);
    expect(outcome.status).toBe(0);
    expect(JSON.parse(outcome.stdout)).toMatchObject({ pass: false, findings_count: 1, findings: [{ file: "legacy.ts", cdCode: "CD-7" }] });
  });

  test("sensor git failures remain structured failures rather than a pass", () => {
    const repository = carvedRepo();
    const outcome = runCli(repository, ["--base-ref", "missing-base", "--output-path", "legacy.ts"]);
    expect(outcome.status).toBe(0);
    expect(JSON.parse(outcome.stdout)).toMatchObject({ pass: false, findings_count: 1 });
  });

  test("a loose blob absent from the selected base tree cannot exempt changed bytes", () => {
    const repository = carvedRepo();
    repository.writeFile({ relativePath: "legacy.ts", body: "export const legacy = 2;\n" });
    repository.run(["hash-object", "-w", "legacy.ts"]);
    const outcome = runCli(repository, ["--json"]);
    expect(outcome.status).toBe(1);
    expect(JSON.parse(outcome.stdout)).toMatchObject({ pass: false, findings_count: 1 });
  });

  test("committed changed bytes outside an older base tree are still a breach", () => {
    const repository = carvedRepo();
    repository.writeFile({ relativePath: "legacy.ts", body: "export const legacy = 2;\n" });
    repository.commitAll({ message: "touched legacy" });
    const outcome = runCli(repository, ["--base-ref", "HEAD~1", "--json"]);
    expect(outcome.status).toBe(1);
    expect(JSON.parse(outcome.stdout)).toMatchObject({ pass: false, findings_count: 1 });
  });

  test("an untracked carved file stays new even when its blob is stored", () => {
    const repository = carvedRepo();
    repository.writeFile({ relativePath: "added.ts", body: "export const added = 3;\n" });
    repository.writeFile({ relativePath: ".constitution-carve-outs/cd-7.json", body: JSON.stringify([
      { files: ["added.ts"], reason: "New exception", decision: "new-entry" },
    ]) });
    repository.run(["hash-object", "-w", "added.ts"]);
    const outcome = runCli(repository, ["--json"]);
    expect(outcome.status).toBe(1);
    expect(JSON.parse(outcome.stdout)).toMatchObject({ pass: false, findings_count: 1, findings: [{ file: "added.ts" }] });
  });

  test("moving unchanged carved bytes preserves the base-tree identity", () => {
    const repository = carvedRepo();
    renameSync(join(repository.path, "legacy.ts"), join(repository.path, "moved.ts"));
    repository.writeFile({ relativePath: ".constitution-carve-outs/cd-7.json", body: JSON.stringify([
      { files: ["moved.ts"], reason: "Imported historical exception", decision: "legacy-import" },
    ]) });
    const outcome = runCli(repository, ["--json"]);
    expect(outcome.status).toBe(0);
    expect(JSON.parse(outcome.stdout)).toMatchObject({ pass: true, findings_count: 0 });
  });

  test("exits non-zero and reports pass:false in JSON when the base ref is unresolvable", () => {
    const repository = newRepo();

    const { status, stdout } = runCli(repository, [
      "--base-ref",
      "origin/main",
      "--json",
    ]);

    expect(status).not.toBe(0);
    expect(JSON.parse(stdout).pass).toBe(false);
  });

  test("exits zero with pass:true when a clean HEAD-based scan touches no carved file", () => {
    const repository = newRepo();

    const { status, stdout } = runCli(repository, ["--json"]);

    expect(status).toBe(0);
    expect(JSON.parse(stdout).pass).toBe(true);
  });
});
