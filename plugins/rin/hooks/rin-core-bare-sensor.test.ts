import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import {
  createHermeticGitRepository,
  type HermeticGitRepository,
} from "../tools/hermetic-git/index.ts";
import {
  emittedAdvisoryFrom,
  PROJECT_DIRECTORY_VARIABLE,
} from "./shared-core-bare.ts";

const SENSOR_PATH = fileURLToPath(
  new URL("./rin-core-bare-sensor.ts", import.meta.url),
);

const SESSION_START_PATH = fileURLToPath(
  new URL("./rin-core-bare-session-start.ts", import.meta.url),
);

const createdRepositories: HermeticGitRepository[] = [];

const newRepository = (): HermeticGitRepository => {
  const repository = createHermeticGitRepository({
    namePrefix: "rin-corebare-sensor-",
  });
  createdRepositories.push(repository);
  repository.run(["config", "core.hooksPath", ""]);
  repository.writeFile({ relativePath: "seed.txt", body: "seed\n" });
  repository.commitAll({ message: "seed" });
  return repository;
};

const runHook = (input: {
  readonly hookPath: string;
  readonly repository: HermeticGitRepository;
}) =>
  spawnSync("bun", [input.hookPath], {
    cwd: input.repository.path,
    env: {
      ...input.repository.environment,
      [PROJECT_DIRECTORY_VARIABLE]: input.repository.path,
    },
    encoding: "utf8",
  });

const advisoryText = (stdout: string): string => {
  const emitted = emittedAdvisoryFrom({ stdout });
  return emitted.state === "silent"
    ? ""
    : emitted.advisory.hookSpecificOutput.additionalContext;
};

const advisoryEventName = (stdout: string): string => {
  const emitted = emittedAdvisoryFrom({ stdout });
  return emitted.state === "silent"
    ? ""
    : emitted.advisory.hookSpecificOutput.hookEventName;
};

const linkedWorktreeOf = (input: {
  readonly repository: HermeticGitRepository;
}): string => {
  const worktreePath = join(input.repository.path, "..", "linked-worktree");
  input.repository.run(["worktree", "add", "-q", "-b", "linked", worktreePath]);
  return worktreePath;
};

afterEach(() => {
  createdRepositories.splice(0).forEach((repository) => {
    repository.dispose();
  });
});

describe("core.bare PostToolUse sensor", () => {
  test("emits nothing on a healthy working-tree repository", () => {
    const repository = newRepository();

    const outcome = runHook({ hookPath: SENSOR_PATH, repository });

    expect(outcome.stdout).toBe("");
    expect(outcome.status).toBe(0);
  });

  test("delivers the warning through the model-visible additionalContext channel", () => {
    const repository = newRepository();
    repository.run(["config", "core.bare", "true"]);

    const outcome = runHook({ hookPath: SENSOR_PATH, repository });

    expect(advisoryText(outcome.stdout)).toContain("core.bare=true");
    expect(advisoryText(outcome.stdout)).toContain(
      "git config core.bare false",
    );
  });

  test("names the PostToolUse event so the harness routes the advisory", () => {
    const repository = newRepository();
    repository.run(["config", "core.bare", "true"]);

    const outcome = runHook({ hookPath: SENSOR_PATH, repository });

    expect(advisoryEventName(outcome.stdout)).toBe("PostToolUse");
  });

  test("cites the shared config path that must be repaired", () => {
    const repository = newRepository();
    repository.run(["config", "core.bare", "true"]);

    const outcome = runHook({ hookPath: SENSOR_PATH, repository });

    expect(advisoryText(outcome.stdout)).toContain(".git");
    expect(advisoryText(outcome.stdout)).toContain("config");
  });

  test("warns without blocking, even on a corrupt repository", () => {
    const repository = newRepository();
    repository.run(["config", "core.bare", "true"]);

    const outcome = runHook({ hookPath: SENSOR_PATH, repository });

    expect(outcome.status).not.toBe(2);
    expect(advisoryText(outcome.stdout)).not.toBe("");
  });

  test("reads the SHARED config from inside a linked worktree", () => {
    const repository = newRepository();
    const worktreePath = linkedWorktreeOf({ repository });
    repository.run(["config", "core.bare", "true"]);

    const outcome = spawnSync("bun", [SENSOR_PATH], {
      cwd: worktreePath,
      env: {
        ...repository.environment,
        [PROJECT_DIRECTORY_VARIABLE]: worktreePath,
      },
      encoding: "utf8",
    });

    expect(advisoryText(outcome.stdout)).toContain("core.bare=true");
  });

  test("stays silent from a linked worktree when the shared config is healthy", () => {
    const repository = newRepository();
    const worktreePath = linkedWorktreeOf({ repository });

    const outcome = spawnSync("bun", [SENSOR_PATH], {
      cwd: worktreePath,
      env: {
        ...repository.environment,
        [PROJECT_DIRECTORY_VARIABLE]: worktreePath,
      },
      encoding: "utf8",
    });

    expect(outcome.stdout).toBe("");
  });

  test("stays silent when the start directory is not a repository", () => {
    const repository = newRepository();
    const outsideAnyRepository = mkdtempSync(
      join(tmpdir(), "rin-corebare-bare-"),
    );

    const outcome = spawnSync("bun", [SENSOR_PATH], {
      cwd: outsideAnyRepository,
      env: {
        ...repository.environment,
        [PROJECT_DIRECTORY_VARIABLE]: outsideAnyRepository,
      },
      encoding: "utf8",
    });

    expect(outcome.error).toBeUndefined();
    expect(outcome.status).toBe(0);
    expect(outcome.stdout).toBe("");
  });
});

describe("advisory payload contract", () => {
  test("rejects a payload missing the advisory text", () => {
    expect(() =>
      emittedAdvisoryFrom({
        stdout: JSON.stringify({
          hookSpecificOutput: { hookEventName: "PostToolUse" },
        }),
      }),
    ).toThrow();
  });

  test("rejects a payload missing the event name", () => {
    expect(() =>
      emittedAdvisoryFrom({
        stdout: JSON.stringify({
          hookSpecificOutput: { additionalContext: "warning" },
        }),
      }),
    ).toThrow();
  });

  test("reports silence for empty output rather than an empty advisory", () => {
    expect(emittedAdvisoryFrom({ stdout: "  " })).toStrictEqual({
      state: "silent",
    });
  });
});

describe("core.bare SessionStart detector", () => {
  test("emits nothing on a healthy working-tree repository", () => {
    const repository = newRepository();

    const outcome = runHook({ hookPath: SESSION_START_PATH, repository });

    expect(outcome.stdout).toBe("");
    expect(outcome.status).toBe(0);
  });

  test("delivers the warning on stdout, the model-visible SessionStart channel", () => {
    const repository = newRepository();
    repository.run(["config", "core.bare", "true"]);

    const outcome = runHook({ hookPath: SESSION_START_PATH, repository });

    expect(outcome.stdout).toContain("core.bare=true");
    expect(outcome.stdout).toContain("git config core.bare false");
  });

  test("warns without blocking, even on a corrupt repository", () => {
    const repository = newRepository();
    repository.run(["config", "core.bare", "true"]);

    const outcome = runHook({ hookPath: SESSION_START_PATH, repository });

    expect(outcome.status).not.toBe(2);
    expect(outcome.stdout).not.toBe("");
  });
});
