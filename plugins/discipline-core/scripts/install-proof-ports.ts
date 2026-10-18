import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, realpathSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import type { Result } from "../core/values/result.ts";
import { type EntryDisposition, type EntryKind, environmentWithoutGit, type StepRun } from "./install-proof-plan.ts";

export type EffectFailure = { readonly kind: "effect-failed"; readonly detail: string };

export type CopiedEntry = { readonly name: string; readonly entryKind: EntryKind };

export type ListedEntry = { readonly path: string; readonly name: string; readonly entryKind: EntryKind };

export type ScratchFilesPort = {
  readonly createTemporaryDirectory: (request: { readonly prefix: string }) => Result<string, EffectFailure>;
  readonly removeTree: (request: { readonly path: string }) => Result<null, EffectFailure>;
  readonly removeFile: (request: { readonly path: string }) => Result<null, EffectFailure>;
  readonly copyTree: (request: {
    readonly from: string;
    readonly to: string;
    readonly disposition: (entry: CopiedEntry) => EntryDisposition;
  }) => Result<null, EffectFailure>;
  readonly listTree: (request: { readonly path: string }) => Result<readonly ListedEntry[], EffectFailure>;
};

export type ScratchFilesSurface = {
  readonly makeTemporaryDirectory: (request: { readonly prefix: string }) => string;
  readonly removeTree: (request: { readonly path: string }) => void;
  readonly removeFile: (request: { readonly path: string }) => void;
  readonly copyTree: (request: {
    readonly from: string;
    readonly to: string;
    readonly disposition: (entry: CopiedEntry) => EntryDisposition;
  }) => void;
  readonly listTree: (request: { readonly path: string }) => readonly ListedEntry[];
};

export type ProofCommand = "git" | "npm" | "node";

export type Launch = "direct" | "shell";

export type CommandEnvironment = Readonly<Record<string, string | undefined>>;

export type CommandSpawnRequest = {
  readonly file: string;
  readonly arguments: readonly string[];
  readonly directory: string;
  readonly environment: CommandEnvironment;
  readonly launch: Launch;
};

export type CommandSpawn = (request: CommandSpawnRequest) => StepRun;

export type CommandRunPort = {
  readonly run: (request: {
    readonly command: ProofCommand;
    readonly arguments: readonly string[];
    readonly directory: string;
  }) => StepRun;
};

const WINDOWS_PLATFORM = "win32";

const failureDetail = (request: { readonly thrown: unknown }): string =>
  request.thrown instanceof Error ? request.thrown.message : String(request.thrown);

const attempted = <T>(request: { readonly action: () => T }): Result<T, EffectFailure> => {
  try {
    return { outcome: "ok", value: request.action() };
  } catch (thrown) {
    return { outcome: "failed", error: { kind: "effect-failed", detail: failureDetail({ thrown }) } };
  }
};

const completed = (request: { readonly action: () => void }): Result<null, EffectFailure> =>
  attempted({
    action: () => {
      request.action();
      return null;
    },
  });

export const createScratchFilesPort = (options: { readonly surface: ScratchFilesSurface }): ScratchFilesPort => ({
  createTemporaryDirectory: (request) =>
    attempted({ action: () => options.surface.makeTemporaryDirectory({ prefix: request.prefix }) }),
  removeTree: (request) => completed({ action: () => options.surface.removeTree({ path: request.path }) }),
  removeFile: (request) => completed({ action: () => options.surface.removeFile({ path: request.path }) }),
  copyTree: (request) =>
    completed({
      action: () =>
        options.surface.copyTree({ from: request.from, to: request.to, disposition: request.disposition }),
    }),
  listTree: (request) => attempted({ action: () => options.surface.listTree({ path: request.path }) }),
});

const launchOf = (request: { readonly command: ProofCommand; readonly platform: string }): Launch => {
  switch (request.command) {
    case "npm":
      return request.platform === WINDOWS_PLATFORM ? "shell" : "direct";
    case "git":
    case "node":
      return "direct";
  }
};

const fileOf = (request: { readonly command: ProofCommand; readonly executablePath: string }): string => {
  switch (request.command) {
    case "node":
      return request.executablePath;
    case "git":
    case "npm":
      return request.command;
  }
};

export const createCommandRunPort = (options: {
  readonly spawn: CommandSpawn;
  readonly platform: string;
  readonly executablePath: string;
  readonly ambientEnvironment: CommandEnvironment;
}): CommandRunPort => {
  const environment = environmentWithoutGit({ environment: options.ambientEnvironment });
  return {
    run: (request) =>
      options.spawn({
        file: fileOf({ command: request.command, executablePath: options.executablePath }),
        arguments: request.arguments,
        directory: request.directory,
        environment,
        launch: launchOf({ command: request.command, platform: options.platform }),
      }),
  };
};

export const defaultScratchFilesSurface: ScratchFilesSurface = {
  makeTemporaryDirectory: (request) => realpathSync(mkdtempSync(join(tmpdir(), request.prefix))),
  removeTree: (request) => {
    rmSync(request.path, { recursive: true, force: true });
  },
  removeFile: (request) => {
    rmSync(request.path);
  },
  copyTree: (request) => {
    cpSync(request.from, request.to, {
      recursive: true,
      filter: (source) =>
        request.disposition({
          name: basename(source),
          entryKind: statSync(source).isDirectory() ? "folder" : "file",
        }) === "kept",
    });
  },
  listTree: (request) =>
    readdirSync(request.path, { recursive: true, withFileTypes: true }).map((entry) => ({
      path: relative(request.path, join(entry.parentPath, entry.name)),
      name: entry.name,
      entryKind: entry.isDirectory() ? "folder" : "file",
    })),
};

const spawnedRun = (request: CommandSpawnRequest): StepRun => {
  try {
    const spawned = spawnSync(request.file, request.arguments, {
      cwd: request.directory,
      env: request.environment,
      encoding: "utf8",
      shell: request.launch === "shell",
    });
    if (spawned.error !== undefined) {
      return { outcome: "not-exited", detail: spawned.error.message };
    }
    return spawned.status === null
      ? { outcome: "not-exited", detail: `signal ${spawned.signal ?? "unknown"}` }
      : { outcome: "exited", exitCode: spawned.status, output: `${spawned.stdout}${spawned.stderr}` };
  } catch (thrown) {
    return { outcome: "not-exited", detail: failureDetail({ thrown }) };
  }
};

export const defaultCommandSpawn: CommandSpawn = spawnedRun;

export const createDefaultScratchFilesPort = (_options: Record<string, never>): ScratchFilesPort =>
  createScratchFilesPort({ surface: defaultScratchFilesSurface });

export const createDefaultCommandRunPort = (_options: Record<string, never>): CommandRunPort =>
  createCommandRunPort({
    spawn: defaultCommandSpawn,
    platform: process.platform,
    executablePath: process.execPath,
    ambientEnvironment: process.env,
  });
