import type { Git } from "./git.ts";

export type PinFacts = {
  readonly pin: string;
  readonly shortPin: string;
  readonly release: string;
  readonly previousRelease: string;
  readonly goldenFileCount: number;
};

export type PinSources = {
  readonly versionModule: string;
  readonly previousReleaseRecord: string;
  readonly goldenFolder: string;
};

const VERSION_ASSIGNMENT = /^export const AIDLC_VERSION = "([^"]+)";$/m;
const SHORT_SHA_LENGTH = 9;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const releaseAt = (git: Git, pin: string, versionModule: string): string => {
  const release = VERSION_ASSIGNMENT.exec(git.show(pin, versionModule))?.[1];
  if (release === undefined) throw new Error(`${versionModule} on ${pin} declares no AIDLC_VERSION`);
  return release;
};

const previousReleaseOn = (git: Git, foundation: string, record: string): string => {
  const parsed: unknown = JSON.parse(git.show(foundation, record));
  const release = isRecord(parsed) ? parsed["release"] : undefined;
  if (typeof release !== "string" || release === "") throw new Error(`${record} on ${foundation} names no release`);
  return release;
};

const filesInGolden = (content: string, path: string): number => {
  const parsed: unknown = JSON.parse(content);
  const files = isRecord(parsed) ? parsed["files"] : undefined;
  if (!isRecord(files)) throw new Error(`${path} has no files map`);
  return Object.keys(files).length;
};

const goldenFileCountOn = (git: Git, foundation: string, folder: string): number =>
  git
    .filesIn(foundation, folder)
    .filter((path) => path.endsWith(".json"))
    .reduce((total, path) => total + filesInGolden(git.show(foundation, path), path), 0);

export const pinFactsFrom = (request: {
  readonly git: Git;
  readonly pin: string;
  readonly foundation: string;
  readonly sources: PinSources;
}): PinFacts => {
  const { git, pin, foundation, sources } = request;
  const full = git.resolve(pin);
  return {
    pin: full,
    shortPin: full.slice(0, SHORT_SHA_LENGTH),
    release: releaseAt(git, full, sources.versionModule),
    previousRelease: previousReleaseOn(git, foundation, sources.previousReleaseRecord),
    goldenFileCount: goldenFileCountOn(git, foundation, sources.goldenFolder),
  };
};
