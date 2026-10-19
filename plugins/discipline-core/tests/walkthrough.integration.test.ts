import { assert, describe, expect, it, vi } from "vitest";
import { checkCommandOutcome } from "../core/check/command-outcome.ts";
import { runCheck } from "../core/check/run-check.ts";
import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { GitPort } from "../core/platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import type { AbsolutePath } from "../core/values/absolute-path.ts";
import { type RepoPath, repoPathSchema } from "../core/values/repo-path.ts";
import expectedReports from "./test-fixtures/walkthrough/expected-reports.json" with { type: "json" };

const path = createDefaultPathPort({});

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const INSTALL_ROOT = resolvedPath({ path: `${import.meta.dirname}/..` });
const BEFORE = resolvedPath({ path: `${import.meta.dirname}/test-fixtures/walkthrough/before` });
const AFTER = resolvedPath({ path: `${import.meta.dirname}/test-fixtures/walkthrough/after` });

const BEFORE_TRACKED: readonly RepoPath[] = [
  repoPathSchema.parse("disciplines.json"),
  repoPathSchema.parse("generated/schema.ts"),
  repoPathSchema.parse("src/basket.test.ts"),
  repoPathSchema.parse("src/basket.ts"),
  repoPathSchema.parse("src/utils/format.ts"),
];

const AFTER_TRACKED: readonly RepoPath[] = [
  repoPathSchema.parse("discipline-exceptions.json"),
  repoPathSchema.parse("disciplines.json"),
  repoPathSchema.parse("generated/schema.ts"),
  repoPathSchema.parse("src/basket.test.ts"),
  repoPathSchema.parse("src/basket.ts"),
  repoPathSchema.parse("src/clock.test.ts"),
  repoPathSchema.parse("src/clock.ts"),
  repoPathSchema.parse("src/format.test.ts"),
  repoPathSchema.parse("src/format.ts"),
];

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



describe("the adopter walkthrough's sample repository, checked against this install through the default runners (CD-47: the shipped pieces and the fixture's own files are the assertion's subject; nothing is spawned or written)", () => {
  it("fails before the fix with one finding per violation and none in the excluded generated folder, exiting 1", async () => {
    expect(await checkedText({ repo: BEFORE, tracked: BEFORE_TRACKED })).toEqual({ code: 1, text: expectedReports.before });
  });

  it("passes after the fix with the clock adapter exempted by its authorised location, exiting 0", async () => {
    expect(await checkedText({ repo: AFTER, tracked: AFTER_TRACKED })).toEqual({ code: 0, text: expectedReports.after });
  });
});
