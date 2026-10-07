import { execFileSync } from "node:child_process";
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

describe("carve-out-decay CLI fail-closed", () => {
  const runCli = (
    repository: HermeticGitRepository,
    args: readonly string[],
  ): { status: number; stdout: string } => {
    try {
      const stdout = execFileSync(
        "bun",
        [TOOL_PATH, "--project-dir", repository.path, ...args],
        {
          cwd: repository.path,
          env: { ...repository.environment },
          encoding: "utf-8",
        },
      );
      return { status: 0, stdout };
    } catch (error) {
      const shaped = error as { status?: number; stdout?: Buffer | string };
      return {
        status: shaped.status ?? 1,
        stdout: shaped.stdout?.toString() ?? "",
      };
    }
  };

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
