import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createHermeticGitRepository,
  type HermeticGitRepository,
} from "../../../rin/tools/hermetic-git/index.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { createGitPort } from "./git-port.ts";

const repositories: HermeticGitRepository[] = [];
const directories: string[] = [];

const newRepository = (): HermeticGitRepository => {
  const repository = createHermeticGitRepository({
    namePrefix: "discipline-core-git-port-",
  });
  repositories.push(repository);
  return repository;
};

const newDirectory = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "discipline-core-not-a-repo-"));
  directories.push(directory);
  return directory;
};

const repositoryWithModifiedAccentedFile = (): {
  readonly repository: HermeticGitRepository;
  readonly base: string;
} => {
  const repository = newRepository();
  repository.writeFile({ relativePath: "é.ts", body: "export const a = 1;\n" });
  repository.commitAll({ message: "first" });
  const base = repository.run(["rev-parse", "HEAD"]).trim();
  repository.writeFile({ relativePath: "é.ts", body: "export const a = 2;\n" });
  return { repository, base };
};

const DEEP_DIRECTORY = Array.from(
  { length: 14 },
  (_, depth) => `${String(depth).padStart(2, "0")}${"d".repeat(200)}`,
).join("/");

const LARGE_LISTING_FILE_COUNT = 360;

const largeListingPath = (request: { readonly index: number }): string =>
  `${DEEP_DIRECTORY}/${String(request.index).padStart(3, "0")}${"f".repeat(200)}.ts`;

const FIRST_LARGE_LISTING_PATH = largeListingPath({ index: 0 });
const LAST_LARGE_LISTING_PATH = largeListingPath({ index: 359 });

const writeLargeListing = (request: {
  readonly repository: HermeticGitRepository;
}): void => {
  mkdirSync(join(request.repository.path, DEEP_DIRECTORY), { recursive: true });
  Array.from({ length: LARGE_LISTING_FILE_COUNT }, (_, index) =>
    largeListingPath({ index }),
  ).forEach((relativePath) => {
    request.repository.writeFile({ relativePath, body: "export {};\n" });
  });
};

const repositoryWithLargeTrackedListing = (): HermeticGitRepository => {
  const repository = newRepository();
  writeLargeListing({ repository });
  repository.commitAll({ message: "large listing" });
  return repository;
};

const repositoryWithLargeListingAfterBase = (): {
  readonly repository: HermeticGitRepository;
  readonly base: string;
} => {
  const repository = newRepository();
  repository.writeFile({ relativePath: "seed.ts", body: "export {};\n" });
  repository.commitAll({ message: "seed" });
  const base = repository.run(["rev-parse", "HEAD"]).trim();
  writeLargeListing({ repository });
  repository.commitAll({ message: "large listing" });
  return { repository, base };
};

afterEach(() => {
  vi.unstubAllEnvs();
  repositories.splice(0).forEach((repository) => {
    repository.dispose();
  });
  directories.splice(0).forEach((directory) => {
    rmSync(directory, { recursive: true, force: true });
  });
});

describe("createGitPort", () => {
  it("lists a tracked non-ASCII path unquoted from trackedPaths", () => {
    const { repository } = repositoryWithModifiedAccentedFile();
    const git = createGitPort({});

    const result = git.trackedPaths({
      repoRoot: absolutePathSchema.parse(repository.path),
    });

    expect(result).toEqual({ outcome: "ok", value: ["é.ts"] });
  });

  it("lists a worktree-modified non-ASCII path unquoted from changedSince", () => {
    const { repository, base } = repositoryWithModifiedAccentedFile();
    const git = createGitPort({});

    const result = git.changedSince({
      repoRoot: absolutePathSchema.parse(repository.path),
      baseRevision: base,
    });

    expect(result).toEqual({ outcome: "ok", value: ["é.ts"] });
  });

  it("includes paths committed after the base in changedSince", () => {
    const { repository, base } = repositoryWithModifiedAccentedFile();
    repository.writeFile({ relativePath: "b.ts", body: "export const b = 1;\n" });
    repository.run(["add", "b.ts"]);
    repository.run(["commit", "-q", "-m", "second"]);
    const git = createGitPort({});

    const result = git.changedSince({
      repoRoot: absolutePathSchema.parse(repository.path),
      baseRevision: base,
    });

    expect(result).toEqual({
      outcome: "ok",
      value: expect.arrayContaining(["b.ts", "é.ts"]),
    });
  });

  it("lists the request's repository, not the one an inherited GIT_DIR names", () => {
    const { repository } = repositoryWithModifiedAccentedFile();
    const other = newRepository();
    other.writeFile({ relativePath: "other.ts", body: "export {};\n" });
    other.commitAll({ message: "other" });
    vi.stubEnv("GIT_DIR", join(other.path, ".git"));

    const result = createGitPort({}).trackedPaths({
      repoRoot: absolutePathSchema.parse(repository.path),
    });

    expect(result).toEqual({ outcome: "ok", value: ["é.ts"] });
  });

  it("returns git-failed with the path in detail when a tracked path is not a RepoPath", () => {
    const repository = newRepository();
    repository.writeFile({ relativePath: "a\\b.ts", body: "export {};\n" });
    repository.commitAll({ message: "backslash" });
    const git = createGitPort({});

    const result = git.trackedPaths({
      repoRoot: absolutePathSchema.parse(repository.path),
    });

    expect(result).toMatchObject({
      outcome: "failed",
      error: { kind: "git-failed", detail: expect.stringContaining("a\\b.ts") },
    });
  });

  it("returns git-failed from trackedPaths outside a repository", () => {
    const git = createGitPort({});

    const result = git.trackedPaths({
      repoRoot: absolutePathSchema.parse(newDirectory()),
    });

    expect(result).toMatchObject({
      outcome: "failed",
      error: { kind: "git-failed", command: expect.stringMatching(/git/) },
    });
  });

  it("returns git-failed from changedSince for an unknown base revision", () => {
    const { repository } = repositoryWithModifiedAccentedFile();
    const git = createGitPort({});

    const result = git.changedSince({
      repoRoot: absolutePathSchema.parse(repository.path),
      baseRevision: "no-such-revision",
    });

    expect(result).toMatchObject({
      outcome: "failed",
      error: { kind: "git-failed" },
    });
  });

  it("lists every tracked path when the listing exceeds one mebibyte", () => {
    const repository = repositoryWithLargeTrackedListing();

    const result = createGitPort({}).trackedPaths({
      repoRoot: absolutePathSchema.parse(repository.path),
    });

    expect(result).toEqual({
      outcome: "ok",
      value: expect.arrayContaining([FIRST_LARGE_LISTING_PATH, LAST_LARGE_LISTING_PATH]),
    });
  });

  it("counts every tracked path when the listing exceeds one mebibyte", () => {
    const repository = repositoryWithLargeTrackedListing();

    const result = createGitPort({}).trackedPaths({
      repoRoot: absolutePathSchema.parse(repository.path),
    });

    expect(result).toHaveProperty("value.length", 360);
  });

  it("lists every path committed after the base when the listing exceeds one mebibyte", () => {
    const { repository, base } = repositoryWithLargeListingAfterBase();

    const result = createGitPort({}).changedSince({
      repoRoot: absolutePathSchema.parse(repository.path),
      baseRevision: base,
    });

    expect(result).toEqual({
      outcome: "ok",
      value: expect.arrayContaining([FIRST_LARGE_LISTING_PATH, LAST_LARGE_LISTING_PATH]),
    });
  });

  it("counts every path committed after the base when the listing exceeds one mebibyte", () => {
    const { repository, base } = repositoryWithLargeListingAfterBase();

    const result = createGitPort({}).changedSince({
      repoRoot: absolutePathSchema.parse(repository.path),
      baseRevision: base,
    });

    expect(result).toHaveProperty("value.length", 360);
  });

  it("returns git-failed for a base revision that begins with a dash", () => {
    const { repository } = repositoryWithModifiedAccentedFile();
    const outputDirectory = newDirectory();

    const result = createGitPort({}).changedSince({
      repoRoot: absolutePathSchema.parse(repository.path),
      baseRevision: `--output=${outputDirectory}/x`,
    });

    expect(result).toMatchObject({
      outcome: "failed",
      error: { kind: "git-failed" },
    });
  });

  it("writes no file when the base revision begins with a dash", () => {
    const { repository } = repositoryWithModifiedAccentedFile();
    const outputDirectory = newDirectory();

    createGitPort({}).changedSince({
      repoRoot: absolutePathSchema.parse(repository.path),
      baseRevision: `--output=${outputDirectory}/x`,
    });

    expect(readdirSync(outputDirectory)).toEqual([]);
  });
});
