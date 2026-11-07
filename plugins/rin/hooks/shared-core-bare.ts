import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { z } from "zod";
import { withoutInheritedGitBindings } from "../tools/hermetic-git/index.ts";

const PROJECT_DIRECTORY_VARIABLE = "CLAUDE_PROJECT_DIR";

const GIT_POINTER_PREFIX = "gitdir:";

const COMMON_DIR_POINTER = "commondir";

const CORRUPT_VALUE = "true";

type SharedCoreBareReading =
  | { readonly state: "unresolved" }
  | { readonly state: "healthy" }
  | { readonly state: "corrupt"; readonly sharedConfigPath: string };

const gitDirectoryPointerTarget = (input: {
  readonly gitPath: string;
}): string | undefined => {
  const pointer = readFileSync(input.gitPath, "utf-8").trim();
  if (!pointer.startsWith(GIT_POINTER_PREFIX)) return undefined;
  return pointer.slice(GIT_POINTER_PREFIX.length).trim();
};

const gitDirectoryFor = (input: {
  readonly startDirectory: string;
}): string | undefined => {
  const gitPath = join(input.startDirectory, ".git");
  if (!existsSync(gitPath)) return undefined;
  if (statSync(gitPath).isDirectory()) return gitPath;

  const target = gitDirectoryPointerTarget({ gitPath });
  if (target === undefined) return undefined;
  return isAbsolute(target) ? target : resolve(input.startDirectory, target);
};

const commonDirectoryFor = (input: {
  readonly gitDirectory: string;
}): string => {
  const pointerPath = join(input.gitDirectory, COMMON_DIR_POINTER);
  if (!existsSync(pointerPath)) return input.gitDirectory;

  const target = readFileSync(pointerPath, "utf-8").trim();
  if (target === "") return input.gitDirectory;
  return isAbsolute(target) ? target : resolve(input.gitDirectory, target);
};

const configuredCoreBare = (input: {
  readonly sharedConfigPath: string;
}): string | undefined => {
  try {
    return execFileSync(
      "git",
      ["config", "--file", input.sharedConfigPath, "--get", "core.bare"],
      {
        encoding: "utf8",
        env: withoutInheritedGitBindings(),
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();
  } catch {
    return undefined;
  }
};

const readSharedCoreBare = (input: {
  readonly startDirectory: string;
}): SharedCoreBareReading => {
  const gitDirectory = gitDirectoryFor({
    startDirectory: input.startDirectory,
  });
  if (gitDirectory === undefined) return { state: "unresolved" };

  const sharedConfigPath = join(commonDirectoryFor({ gitDirectory }), "config");
  if (!existsSync(sharedConfigPath)) return { state: "unresolved" };

  return configuredCoreBare({ sharedConfigPath }) === CORRUPT_VALUE
    ? { state: "corrupt", sharedConfigPath }
    : { state: "healthy" };
};

const corruptionWarning = (input: {
  readonly sharedConfigPath: string;
}): string =>
  [
    "core.bare=true is set in this repository's SHARED git config.",
    `Shared config: ${input.sharedConfigPath}`,
    "The checkout has a working tree, so this value is corruption, not configuration:",
    'work-tree git operations will fail repo-wide with "must be run in a work tree",',
    'and `git pull` can report "Already up to date" while the working files stay frozen.',
    "",
    "Repair (from the primary checkout): git config core.bare false",
    "Then confirm recovery: git status",
    "",
    "Cause class: a process spawning git while inheriting a git hook's GIT_DIR.",
    "See CD-47 for the hermetic Git requirement.",
  ].join("\n");

const invokedProjectDirectory = (): string =>
  process.env[PROJECT_DIRECTORY_VARIABLE] ?? process.cwd();

const advisoryContextSchema = z.object({
  hookSpecificOutput: z.object({
    hookEventName: z.string().min(1),
    additionalContext: z.string().min(1),
  }),
});

type AdvisoryContext = z.infer<typeof advisoryContextSchema>;

type EmittedAdvisory =
  | { readonly state: "silent" }
  | { readonly state: "advised"; readonly advisory: AdvisoryContext };

const advisoryContextPayload = (input: {
  readonly hookEventName: string;
  readonly additionalContext: string;
}): string =>
  JSON.stringify(
    advisoryContextSchema.parse({
      hookSpecificOutput: {
        hookEventName: input.hookEventName,
        additionalContext: input.additionalContext,
      },
    }),
  );

const emittedAdvisoryFrom = (input: {
  readonly stdout: string;
}): EmittedAdvisory => {
  const trimmed = input.stdout.trim();
  if (trimmed.length === 0) return { state: "silent" };
  return {
    state: "advised",
    advisory: advisoryContextSchema.parse(JSON.parse(trimmed)),
  };
};

export type { AdvisoryContext, EmittedAdvisory, SharedCoreBareReading };
export {
  advisoryContextPayload,
  corruptionWarning,
  emittedAdvisoryFrom,
  invokedProjectDirectory,
  PROJECT_DIRECTORY_VARIABLE,
  readSharedCoreBare,
};
