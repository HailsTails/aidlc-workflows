import { describe, expect, it, vi } from "vitest";
import type { EntryDisposition, StepRun } from "./install-proof-plan.ts";
import {
  type CommandSpawn,
  type CopiedEntry,
  createCommandRunPort,
  createScratchFilesPort,
  type ScratchFilesSurface,
} from "./install-proof-ports.ts";

const PERMISSION_DENIED = new Error("EACCES: permission denied, rm '/scratch/proof'");

const EXITED_CLEAN: StepRun = { outcome: "exited", exitCode: 0, output: "" };

const AMBIENT_ENVIRONMENT = {
  GIT_DIR: "/elsewhere/.git",
  GIT_INDEX_FILE: "/elsewhere/.git/index",
  PATH: "/usr/bin",
  HOME: "/home/someone",
};

const surfaceOver = (surface: Partial<ScratchFilesSurface>): ScratchFilesSurface => ({
  makeTemporaryDirectory: vi.fn(),
  removeTree: vi.fn(),
  removeFile: vi.fn(),
  copyTree: vi.fn(),
  listTree: vi.fn(),
  ...surface,
});

const keepEverything = (_entry: CopiedEntry): EntryDisposition => "kept";

const commandsOver = (request: { readonly spawn: CommandSpawn; readonly platform: string }) =>
  createCommandRunPort({
    spawn: request.spawn,
    platform: request.platform,
    executablePath: "/opt/node/bin/node",
    ambientEnvironment: AMBIENT_ENVIRONMENT,
  });

describe("createScratchFilesPort createTemporaryDirectory", () => {
  it("returns the directory the surface made, for the requested prefix", () => {
    const makeTemporaryDirectory = vi.fn<ScratchFilesSurface["makeTemporaryDirectory"]>().mockReturnValue("/scratch/proof-1");

    const created = createScratchFilesPort({ surface: surfaceOver({ makeTemporaryDirectory }) }).createTemporaryDirectory({
      prefix: "proof-",
    });

    expect({ created, calls: makeTemporaryDirectory.mock.calls }).toEqual({
      created: { outcome: "ok", value: "/scratch/proof-1" },
      calls: [[{ prefix: "proof-" }]],
    });
  });

  it("returns effect-failed with the thrown message when the surface throws", () => {
    const created = createScratchFilesPort({
      surface: surfaceOver({ makeTemporaryDirectory: vi.fn<ScratchFilesSurface["makeTemporaryDirectory"]>().mockThrow(PERMISSION_DENIED) }),
    }).createTemporaryDirectory({ prefix: "proof-" });

    expect(created).toEqual({
      outcome: "failed",
      error: { kind: "effect-failed", detail: "EACCES: permission denied, rm '/scratch/proof'" },
    });
  });
});

describe("createScratchFilesPort removeTree and removeFile", () => {
  it("removes the requested tree", () => {
    const removeTree = vi.fn<ScratchFilesSurface["removeTree"]>();

    const removed = createScratchFilesPort({ surface: surfaceOver({ removeTree }) }).removeTree({ path: "/scratch/proof" });

    expect({ removed, calls: removeTree.mock.calls }).toEqual({
      removed: { outcome: "ok", value: null },
      calls: [[{ path: "/scratch/proof" }]],
    });
  });

  it("returns effect-failed when removing the tree throws", () => {
    const removed = createScratchFilesPort({ surface: surfaceOver({ removeTree: vi.fn<ScratchFilesSurface["removeTree"]>().mockThrow(PERMISSION_DENIED) }) }).removeTree({
      path: "/scratch/proof",
    });

    expect(removed).toEqual({
      outcome: "failed",
      error: { kind: "effect-failed", detail: "EACCES: permission denied, rm '/scratch/proof'" },
    });
  });

  it("removes the requested file", () => {
    const removeFile = vi.fn<ScratchFilesSurface["removeFile"]>();

    const removed = createScratchFilesPort({ surface: surfaceOver({ removeFile }) }).removeFile({ path: "/repo/src/kept.ts" });

    expect({ removed, calls: removeFile.mock.calls }).toEqual({
      removed: { outcome: "ok", value: null },
      calls: [[{ path: "/repo/src/kept.ts" }]],
    });
  });

  it("returns effect-failed when removing the file throws", () => {
    const removed = createScratchFilesPort({ surface: surfaceOver({ removeFile: vi.fn<ScratchFilesSurface["removeFile"]>().mockThrow(PERMISSION_DENIED) }) }).removeFile({
      path: "/repo/src/kept.ts",
    });

    expect(removed).toEqual({
      outcome: "failed",
      error: { kind: "effect-failed", detail: "EACCES: permission denied, rm '/scratch/proof'" },
    });
  });
});

describe("createScratchFilesPort copyTree", () => {
  it("copies from and to the requested paths with the given disposition", () => {
    const copyTree = vi.fn<ScratchFilesSurface["copyTree"]>();

    const copied = createScratchFilesPort({ surface: surfaceOver({ copyTree }) }).copyTree({
      from: "/package/core",
      to: "/repo/tools/discipline-core/core",
      disposition: keepEverything,
    });

    expect({ copied, calls: copyTree.mock.calls }).toEqual({
      copied: { outcome: "ok", value: null },
      calls: [[{ from: "/package/core", to: "/repo/tools/discipline-core/core", disposition: keepEverything }]],
    });
  });

  it("returns effect-failed when copying throws", () => {
    const copied = createScratchFilesPort({ surface: surfaceOver({ copyTree: vi.fn<ScratchFilesSurface["copyTree"]>().mockThrow(PERMISSION_DENIED) }) }).copyTree({
      from: "/package/core",
      to: "/repo/tools/discipline-core/core",
      disposition: keepEverything,
    });

    expect(copied).toEqual({
      outcome: "failed",
      error: { kind: "effect-failed", detail: "EACCES: permission denied, rm '/scratch/proof'" },
    });
  });
});

describe("createScratchFilesPort listTree", () => {
  it("returns the entries the surface listed under the requested path", () => {
    const listTree = vi
      .fn<ScratchFilesSurface["listTree"]>()
      .mockReturnValue([{ path: "core/check/a.ts", name: "a.ts", entryKind: "file" }]);

    const listed = createScratchFilesPort({ surface: surfaceOver({ listTree }) }).listTree({ path: "/repo/tools/discipline-core" });

    expect({ listed, calls: listTree.mock.calls }).toEqual({
      listed: { outcome: "ok", value: [{ path: "core/check/a.ts", name: "a.ts", entryKind: "file" }] },
      calls: [[{ path: "/repo/tools/discipline-core" }]],
    });
  });

  it("returns effect-failed when listing throws", () => {
    const listed = createScratchFilesPort({ surface: surfaceOver({ listTree: vi.fn<ScratchFilesSurface["listTree"]>().mockThrow(PERMISSION_DENIED) }) }).listTree({ path: "/repo/tools/discipline-core" });

    expect(listed).toEqual({
      outcome: "failed",
      error: { kind: "effect-failed", detail: "EACCES: permission denied, rm '/scratch/proof'" },
    });
  });
});

describe("createCommandRunPort run", () => {
  it("runs git by name, directly, in the requested directory, with the ambient environment less every GIT_ variable", () => {
    const spawn = vi.fn<CommandSpawn>().mockReturnValue(EXITED_CLEAN);

    commandsOver({ spawn, platform: "linux" }).run({ command: "git", arguments: ["init", "-q"], directory: "/repo" });

    expect(spawn.mock.calls).toEqual([
      [
        {
          file: "git",
          arguments: ["init", "-q"],
          directory: "/repo",
          environment: { PATH: "/usr/bin", HOME: "/home/someone" },
          launch: "direct",
        },
      ],
    ]);
  });

  it("runs node as the injected executable path", () => {
    const spawn = vi.fn<CommandSpawn>().mockReturnValue(EXITED_CLEAN);

    commandsOver({ spawn, platform: "linux" }).run({ command: "node", arguments: ["entry.ts"], directory: "/repo" });

    expect(spawn).toHaveBeenCalledWith(expect.objectContaining({ file: "/opt/node/bin/node", launch: "direct" }));
  });

  it("runs npm directly off Windows", () => {
    const spawn = vi.fn<CommandSpawn>().mockReturnValue(EXITED_CLEAN);

    commandsOver({ spawn, platform: "linux" }).run({ command: "npm", arguments: ["install"], directory: "/root" });

    expect(spawn).toHaveBeenCalledWith(expect.objectContaining({ file: "npm", launch: "direct" }));
  });

  it("runs npm through a shell on Windows", () => {
    const spawn = vi.fn<CommandSpawn>().mockReturnValue(EXITED_CLEAN);

    commandsOver({ spawn, platform: "win32" }).run({ command: "npm", arguments: ["install"], directory: "C:\\root" });

    expect(spawn).toHaveBeenCalledWith(expect.objectContaining({ file: "npm", launch: "shell" }));
  });

  it("runs git directly on Windows", () => {
    const spawn = vi.fn<CommandSpawn>().mockReturnValue(EXITED_CLEAN);

    commandsOver({ spawn, platform: "win32" }).run({ command: "git", arguments: ["init"], directory: "C:\\repo" });

    expect(spawn).toHaveBeenCalledWith(expect.objectContaining({ file: "git", launch: "direct" }));
  });

  it("returns the run the spawn reported", () => {
    const run = commandsOver({
      spawn: vi.fn<CommandSpawn>().mockReturnValue({ outcome: "not-exited", detail: "spawnSync npm ENOENT" }),
      platform: "linux",
    }).run({ command: "npm", arguments: ["install"], directory: "/root" });

    expect(run).toEqual({ outcome: "not-exited", detail: "spawnSync npm ENOENT" });
  });
});
