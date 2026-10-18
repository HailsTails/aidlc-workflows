import { assert, describe, expect, it, vi } from "vitest";
import type { ExecutionPort } from "../../core/platform-ports/execution-port.ts";
import type { FileTextPort, TemporaryDirectory, TemporaryDirectoryPort } from "../../core/platform-ports/file-system-port.ts";
import type { PathPort } from "../../core/platform-ports/path-port.ts";
import { type AbsolutePath, absolutePathSchema } from "../../core/values/absolute-path.ts";
import { createHermeticGitRepositoryWithPorts } from "./index.ts";

const ENCLOSURE = absolutePathSchema.parse("H:\\temporary fixtures\\owned");
const REPOSITORY = absolutePathSchema.parse("H:\\temporary fixtures\\owned\\repository");
const CONFIG_HOME = absolutePathSchema.parse("H:\\temporary fixtures\\owned\\home");
const ENVIRONMENT = {
  PATH: "fixture search path",
  HOME: CONFIG_HOME,
  USERPROFILE: CONFIG_HOME,
  GIT_CONFIG_GLOBAL: "H:\\temporary fixtures\\owned\\home/.gitconfig",
  GIT_CONFIG_SYSTEM: "H:\\temporary fixtures\\owned\\home/.gitconfig-system",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_TERMINAL_PROMPT: "0",
  GIT_AUTHOR_NAME: "Hermetic Fixture",
  GIT_AUTHOR_EMAIL: "hermetic@fixture.invalid",
  GIT_COMMITTER_NAME: "Hermetic Fixture",
  GIT_COMMITTER_EMAIL: "hermetic@fixture.invalid",
};

describe("official hermetic Git repository construction", () => {
  it("allocates its enclosure and binds isolated Git policy before returning the initialized repository and its explicit lifetime", () => {
    const dispose = vi.fn<TemporaryDirectory["dispose"]>().mockReturnValue({ outcome: "ok", value: undefined });
    const create = vi.fn<TemporaryDirectoryPort["create"]>().mockReturnValue({
      outcome: "ok", value: { path: ENCLOSURE, dispose },
    });
    const fileText: FileTextPort = {
      read: vi.fn<FileTextPort["read"]>(),
      exists: vi.fn<FileTextPort["exists"]>(),
      write: vi.fn<FileTextPort["write"]>(),
    };
    const children = new Map([["repository", REPOSITORY], ["home", CONFIG_HOME]]);
    const resolvedPaths = new Map<string, AbsolutePath>([[REPOSITORY, REPOSITORY], [CONFIG_HOME, CONFIG_HOME]]);
    const path: PathPort = {
      join: ({ segments }) => children.get(segments[1] ?? "") ?? assert.fail("unexpected child path"),
      resolve: ({ path: joined }) => ({ outcome: "ok", value: resolvedPaths.get(joined) ?? assert.fail("unexpected fixture path resolution") }),
      joinRepository: vi.fn<PathPort["joinRepository"]>(),
      relative: vi.fn<PathPort["relative"]>(),
      directoryOf: vi.fn<PathPort["directoryOf"]>(),
      repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
      fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
    };
    const join = vi.spyOn(path, "join");
    const resolve = vi.spyOn(path, "resolve");
    const run = vi.fn<ExecutionPort["run"]>().mockReturnValue({
      outcome: "ok", value: { status: 0, stdout: "initialized", stderr: "" },
    });
    const execution = vi.fn<Parameters<typeof createHermeticGitRepositoryWithPorts>[0]["execution"]>()
      .mockReturnValue({ run });

    const repository = createHermeticGitRepositoryWithPorts({
      namePrefix: "fixture-",
      ambient: { PATH: "fixture search path", GIT_DIR: "inherited directory" },
      temporaryDirectories: { create }, fileText, path, execution,
    });

    expect(repository).toMatchObject({ outcome: "ok", value: { path: REPOSITORY, environment: ENVIRONMENT } });
    assert(repository.outcome === "ok");
    expect(create).toHaveBeenCalledExactlyOnceWith({ namePrefix: "fixture-" });
    expect(join).toHaveBeenCalledWith({ segments: [ENCLOSURE, "repository"] });
    expect(join).toHaveBeenCalledWith({ segments: [ENCLOSURE, "home"] });
    expect(resolve).toHaveBeenCalledWith({ path: REPOSITORY });
    expect(resolve).toHaveBeenCalledWith({ path: CONFIG_HOME });
    expect(execution).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      policy: {
        executable: "git", environment: expect.any(Function),
        timeoutMilliseconds: undefined, maximumOutputBytes: 1048576,
      },
    }));
    const construction = execution.mock.calls[0];
    assert(construction !== undefined);
    expect(construction[0].policy.environment({ ambient: construction[0].ambientEnvironment })).toStrictEqual(ENVIRONMENT);
    expect(run).toHaveBeenCalledExactlyOnceWith({
      arguments: ["init", "-q", "-b", "main", "--", REPOSITORY], cwd: ENCLOSURE,
    });
    expect(dispose).not.toHaveBeenCalled();
    expect(repository.value.dispose()).toEqual({ outcome: "ok", value: undefined });
    expect(dispose).toHaveBeenCalledExactlyOnceWith();
  });
});
