import { assert, describe, expect, it, vi } from "vitest";
import { checkCommandOutcome } from "../core/check/command-outcome.ts";
import { runCheck } from "../core/check/run-check.ts";
import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { GitPort } from "../core/platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import type { AbsolutePath } from "../core/values/absolute-path.ts";
import { type RepoPath, repoPathSchema } from "../core/values/repo-path.ts";

const path = createDefaultPathPort({});

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const INSTALL_ROOT = resolvedPath({ path: `${import.meta.dirname}/..` });
const BEFORE = resolvedPath({ path: `${import.meta.dirname}/test-fixtures/walkthrough/before` });
const AFTER = resolvedPath({ path: `${import.meta.dirname}/test-fixtures/walkthrough/after` });

const trackedPathsOf = (request: { readonly paths: readonly string[] }): readonly RepoPath[] =>
  request.paths.map((tracked) => repoPathSchema.parse(tracked));

const BEFORE_TRACKED = trackedPathsOf({
  paths: [
    "disciplines.json",
    "generated/schema.ts",
    "src/basket.test.ts",
    "src/basket.ts",
    "src/utils/format.ts",
  ],
});

const AFTER_TRACKED = trackedPathsOf({
  paths: [
    "discipline-exceptions.json",
    "disciplines.json",
    "generated/schema.ts",
    "src/basket.test.ts",
    "src/basket.ts",
    "src/clock.test.ts",
    "src/clock.ts",
    "src/format.test.ts",
    "src/format.ts",
  ],
});

const checkedText = async (request: { readonly repo: AbsolutePath; readonly tracked: readonly RepoPath[] }) => {
  const git: GitPort = {
    trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: request.tracked }),
    changedSince: vi.fn<GitPort["changedSince"]>(),
    contentInBase: vi.fn<GitPort["contentInBase"]>(),
  };
  return checkCommandOutcome({
    result: await runCheck({
      repoRoot: request.repo,
      installRoot: INSTALL_ROOT,
      baseRevision: undefined,
      fileText: createDefaultFileTextPort({}),
      modules: createDefaultModuleLoaderPort({}),
      path,
      git,
    }),
  });
};

const BEFORE_REPORT = [
  "findings (7)",
  "CD-14#class-syntax walker src/basket.ts:5:7 export class Basket {",
  "CD-17#clock-sources walker src/basket.ts:7:0 private openedAt = Date.now();",
  "CD-2#cast-expressions walker src/basket.ts:10:20 entry as Line);   }    total(): string {     let pence = 0;     for (const line …",
  "CD-15#loops walker src/basket.ts:15:0 for (const line of this.lines) {",
  "CD-17#clock-sources walker src/basket.ts:22:0 return Date.now() - this.openedAt;",
  "CD-7#categorical-paths walker src/utils/format.ts:1:0 forbidden categorical folder: utils",
  "CD-23#export-test-sibling walker src/utils/format.ts:1:0 missing co-located *.test.ts(x) sibling",
  "verdict: fail",
  "",
].join("\n");

const AFTER_REPORT = [
  "exempted (1)",
  "CD-17#clock-sources walker src/clock.ts:3:0 export const createSystemClock = (): Clock => ({ now: () => Date.now() }); exempted by authorised-location",
  "verdict: pass",
  "",
].join("\n");

describe("the adopter walkthrough's sample repository, checked against this install through the default runners (CD-47: the shipped pieces and the fixture's own files are the assertion's subject; nothing is spawned or written)", () => {
  it("fails before the fix with one finding per violation and none in the excluded generated folder, exiting 1", async () => {
    expect(await checkedText({ repo: BEFORE, tracked: BEFORE_TRACKED })).toEqual({ code: 1, text: BEFORE_REPORT });
  });

  it("passes after the fix with the clock adapter exempted by its authorised location, exiting 0", async () => {
    expect(await checkedText({ repo: AFTER, tracked: AFTER_TRACKED })).toEqual({ code: 0, text: AFTER_REPORT });
  });
});
