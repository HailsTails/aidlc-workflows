import { assert, describe, expect, it, vi } from "vitest";
import type { ExecutionPort } from "../../core/platform-ports/execution-port.ts";
import type { FileTextPort, TemporaryDirectory, TemporaryDirectoryPort } from "../../core/platform-ports/file-system-port.ts";
import type { PathPort } from "../../core/platform-ports/path-port.ts";
import { type AbsolutePath, absolutePathSchema } from "../../core/values/absolute-path.ts";
import { createHermeticGitRepositoryWithPorts } from "./hermetic-git-repository.ts";

const ENCLOSURE = absolutePathSchema.parse("H:\\temporary fixtures\\owned");
const REPOSITORY = absolutePathSchema.parse("H:\\temporary fixtures\\owned\\repository");
const CONFIG_HOME = absolutePathSchema.parse("H:\\temporary fixtures\\owned\\home");
const SEED_FILE = "H:\\temporary fixtures\\owned\\repository\\seed.txt";
const SUCCESSFUL_EXIT = { outcome: "ok", value: { status: 0, stdout: "command output", stderr: "" } } satisfies ReturnType<ExecutionPort["run"]>;
const HOST_FAILURE = {
  outcome: "failed",
  error: { kind: "launch-failed", detail: "fixture Git unavailable", stdout: "partial out", stderr: "launch detail", code: "ENOENT", signal: undefined },
} satisfies ReturnType<ExecutionPort["run"]>;

const repositoryFixture = () => {
  const dispose = vi.fn<TemporaryDirectory["dispose"]>().mockReturnValue({ outcome: "ok", value: undefined });
  const create = vi.fn<TemporaryDirectoryPort["create"]>().mockReturnValue({
    outcome: "ok", value: { path: ENCLOSURE, dispose },
  });
  const write = vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "ok", value: undefined });
  const fileText: FileTextPort = {
    read: vi.fn<FileTextPort["read"]>(), exists: vi.fn<FileTextPort["exists"]>(), write,
  };
  const joinedPaths = new Map([
    [`${ENCLOSURE}|repository`, REPOSITORY], [`${ENCLOSURE}|home`, CONFIG_HOME],
    [`${REPOSITORY}|seed.txt`, SEED_FILE],
  ]);
  const resolvedPaths = new Map<string, AbsolutePath>([[REPOSITORY, REPOSITORY], [CONFIG_HOME, CONFIG_HOME]]);
  const path: PathPort = {
    join: ({ segments }) => joinedPaths.get(`${segments[0]}|${segments[1]}`) ?? assert.fail("unexpected fixture path join"),
    resolve: ({ path: joined }) => ({ outcome: "ok", value: resolvedPaths.get(joined) ?? assert.fail("unexpected fixture path resolution") }),
    joinRepository: vi.fn<PathPort["joinRepository"]>(), relative: vi.fn<PathPort["relative"]>(),
    directoryOf: vi.fn<PathPort["directoryOf"]>(), repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
    fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
  };
  const resolve = vi.spyOn(path, "resolve");
  const run = vi.fn<ExecutionPort["run"]>().mockReturnValue(SUCCESSFUL_EXIT);
  const execution = vi.fn<Parameters<typeof createHermeticGitRepositoryWithPorts>[0]["execution"]>()
    .mockReturnValue({ run });
  const options: Parameters<typeof createHermeticGitRepositoryWithPorts>[0] = {
    ambient: { PATH: "fixture search path" }, temporaryDirectories: { create }, fileText, path, execution,
  };
  return { options, dispose, create, write, resolve, run, execution };
};

describe("hermetic Git repository failures and operations", () => {
  it("retains allocation failure before any enclosure or Git operation exists", () => {
    const fixture = repositoryFixture();
    fixture.create.mockReturnValue({ outcome: "failed", error: {
      kind: "temporary-directory-create-failed", namePrefix: "rin-hermetic-", detail: "fixture allocation refused",
    } });

    expect(createHermeticGitRepositoryWithPorts(fixture.options)).toStrictEqual({ outcome: "failed", error: {
      kind: "repository-creation-failed", enclosure: undefined,
      failure: { kind: "temporary-directory-create-failed", namePrefix: "rin-hermetic-", detail: "fixture allocation refused" },
    } });
    expect(fixture.create).toHaveBeenCalledExactlyOnceWith({ namePrefix: "rin-hermetic-" });
    expect(fixture.execution).not.toHaveBeenCalled();
    expect(fixture.dispose).not.toHaveBeenCalled();
  });

  it("retains its allocated enclosure when path resolution fails without adding automatic cleanup", () => {
    const fixture = repositoryFixture();
    fixture.resolve.mockReturnValueOnce({ outcome: "failed", error: { kind: "working-directory-unusable", path: REPOSITORY } });

    expect(createHermeticGitRepositoryWithPorts(fixture.options)).toStrictEqual({ outcome: "failed", error: {
      kind: "repository-creation-failed", enclosure: ENCLOSURE,
      failure: { kind: "arguments-invalid", detail: expect.stringMatching(/\S/) },
    } });
    expect(fixture.execution).not.toHaveBeenCalled();
    expect(fixture.dispose).not.toHaveBeenCalled();
  });

  it("preserves a failed initialization exit and its enclosure without returning a repository or cleaning it automatically", () => {
    const fixture = repositoryFixture();
    fixture.run.mockReturnValue({ outcome: "ok", value: { status: 2, stdout: "partial init output", stderr: "init refused" } });

    expect(createHermeticGitRepositoryWithPorts(fixture.options)).toStrictEqual({ outcome: "failed", error: {
      kind: "repository-creation-failed", enclosure: ENCLOSURE,
      failure: {
        kind: "git-exited", arguments: ["init", "-q", "-b", "main", "--", REPOSITORY],
        exit: { status: 2, stdout: "partial init output", stderr: "init refused" },
      },
    } });
    expect(fixture.dispose).not.toHaveBeenCalled();
    expect(fixture.run).toHaveBeenCalledTimes(1);
  });

  it("returns successful command stdout and forwards its ordered arguments at the owned repository cwd", () => {
    const fixture = repositoryFixture();
    const repository = createHermeticGitRepositoryWithPorts(fixture.options);
    assert(repository.outcome === "ok");

    expect(repository.value.run({ arguments: ["log", "-1", "--format=%s"] })).toEqual({ outcome: "ok", value: "command output" });
    expect(fixture.run).toHaveBeenNthCalledWith(2, { arguments: ["log", "-1", "--format=%s"], cwd: REPOSITORY });
    expect(fixture.run).toHaveBeenCalledTimes(2);
  });

  it("preserves complete execution failure data rather than returning partial command stdout", () => {
    const fixture = repositoryFixture();
    fixture.run.mockReturnValueOnce(SUCCESSFUL_EXIT).mockReturnValueOnce(HOST_FAILURE);
    const repository = createHermeticGitRepositoryWithPorts(fixture.options);
    assert(repository.outcome === "ok");

    expect(repository.value.run({ arguments: ["status", "--porcelain"] })).toStrictEqual({ outcome: "failed", error: {
      kind: "execution-failed", arguments: ["status", "--porcelain"], failure: HOST_FAILURE.error,
    } });
  });

  it("delegates each native file write and preserves the affected path and failure detail", () => {
    const fixture = repositoryFixture();
    fixture.write.mockReturnValueOnce({ outcome: "ok", value: undefined }).mockReturnValueOnce({
      outcome: "failed", error: { kind: "unwritable", path: SEED_FILE, detail: "fixture write refused" },
    });
    const repository = createHermeticGitRepositoryWithPorts(fixture.options);
    assert(repository.outcome === "ok");

    expect(repository.value.writeFile({ relativePath: "seed.txt", body: "first seed\n" })).toEqual({ outcome: "ok", value: undefined });
    expect(repository.value.writeFile({ relativePath: "seed.txt", body: "second seed\n" })).toEqual({ outcome: "failed", error: {
      kind: "file-unwritable", path: SEED_FILE, detail: "fixture write refused",
    } });
    expect(fixture.write).toHaveBeenNthCalledWith(1, { path: SEED_FILE, text: "first seed\n" });
    expect(fixture.write).toHaveBeenNthCalledWith(2, { path: SEED_FILE, text: "second seed\n" });
    expect(fixture.write).toHaveBeenCalledTimes(2);
  });

  it("adds before committing with the supplied message and returns explicit success", () => {
    const fixture = repositoryFixture();
    const repository = createHermeticGitRepositoryWithPorts(fixture.options);
    assert(repository.outcome === "ok");

    expect(repository.value.commitAll({ message: "fixture seed" })).toEqual({ outcome: "ok", value: undefined });
    expect(fixture.run).toHaveBeenNthCalledWith(2, { arguments: ["add", "-A"], cwd: REPOSITORY });
    expect(fixture.run).toHaveBeenNthCalledWith(3, { arguments: ["commit", "-q", "-m", "fixture seed"], cwd: REPOSITORY });
    expect(fixture.run).toHaveBeenCalledTimes(3);
  });

  it("stops on failed add without attempting commit and preserves the actual execution failure", () => {
    const fixture = repositoryFixture();
    fixture.run.mockReturnValueOnce(SUCCESSFUL_EXIT).mockReturnValueOnce(HOST_FAILURE);
    const repository = createHermeticGitRepositoryWithPorts(fixture.options);
    assert(repository.outcome === "ok");

    expect(repository.value.commitAll({ message: "fixture seed" })).toStrictEqual({ outcome: "failed", error: {
      kind: "execution-failed", arguments: ["add", "-A"], failure: HOST_FAILURE.error,
    } });
    expect(fixture.run).toHaveBeenNthCalledWith(2, { arguments: ["add", "-A"], cwd: REPOSITORY });
    expect(fixture.run).toHaveBeenCalledTimes(2);
  });

  it("returns a failed commit exit after successful add without certifying commit success", () => {
    const fixture = repositoryFixture();
    fixture.run.mockReturnValueOnce(SUCCESSFUL_EXIT).mockReturnValueOnce(SUCCESSFUL_EXIT).mockReturnValueOnce({
      outcome: "ok", value: { status: 1, stdout: "partial commit output", stderr: "commit refused" },
    });
    const repository = createHermeticGitRepositoryWithPorts(fixture.options);
    assert(repository.outcome === "ok");

    expect(repository.value.commitAll({ message: "fixture seed" })).toStrictEqual({ outcome: "failed", error: {
      kind: "git-exited", arguments: ["commit", "-q", "-m", "fixture seed"],
      exit: { status: 1, stdout: "partial commit output", stderr: "commit refused" },
    } });
    expect(fixture.run).toHaveBeenCalledTimes(3);
  });

  it("propagates explicit disposal failure from its own allocation", () => {
    const fixture = repositoryFixture();
    fixture.dispose.mockReturnValue({ outcome: "failed", error: {
      kind: "temporary-directory-remove-failed", path: ENCLOSURE, detail: "fixture removal refused",
    } });
    const repository = createHermeticGitRepositoryWithPorts(fixture.options);
    assert(repository.outcome === "ok");

    expect(repository.value.dispose()).toEqual({ outcome: "failed", error: {
      kind: "temporary-directory-remove-failed", path: ENCLOSURE, detail: "fixture removal refused",
    } });
    expect(fixture.dispose).toHaveBeenCalledExactlyOnceWith();
  });
});
