import { assert, describe, expect, it, vi } from "vitest";
import { runCheck } from "../core/check/run-check.ts";
import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { GitPort } from "../core/platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import type { AbsolutePath } from "../core/values/absolute-path.ts";
import { repoPathSchema } from "../core/values/repo-path.ts";

const path = createDefaultPathPort({});

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const git: GitPort = {
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({
    outcome: "ok",
    value: [
      repoPathSchema.parse("discipline-exceptions.json"),
      repoPathSchema.parse("disciplines.json"),
      repoPathSchema.parse("src/parse.ts"),
    ],
  }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
};

describe("the shipped CD-1 rule, read from rules/CD-1/discipline.json through a full check (CD-47: the shipped rule file is the assertion's subject; nothing is spawned or written)", () => {
  it("refuses an otherwise complete authorised-location for CD-1 as a non-exemptible clause", async () => {
    expect(
      await runCheck({
        repoRoot: resolvedPath({ path: `${import.meta.dirname}/test-fixtures/cd1-refused` }),
        installRoot: resolvedPath({ path: `${import.meta.dirname}/..` }),
        baseRevision: undefined,
        fileText: createDefaultFileTextPort({}),
        modules: createDefaultModuleLoaderPort({}),
        path,
        git,
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        invalidRecords: [
          { index: 0, problem: { kind: "non-exemptible-clause", clause: { ruleSet: "shared", discipline: "CD-1", clause: "any-cast" } } },
        ],
      },
    });
  });
});
