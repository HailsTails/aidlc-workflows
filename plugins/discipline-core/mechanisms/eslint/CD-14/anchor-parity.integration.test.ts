import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort, createPathPort } from "../../../core/platform-ports/path-port.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { check } from "../../walker/CD-14/class-syntax.ts";
import { createWalkerRunner } from "../../walker/runner/create-walker-runner.ts";
import { createDefaultParsePort } from "../../walker/runner/typescript-parse.ts";
import { createDefaultEslintPort } from "../runner/eslint-instance.ts";
import { eslintPluginModuleSchema } from "../runner/eslint-plugin-schema.ts";
import classAuthoringPlugin from "./cd14/cd14.eslint-plugin.ts";

const PIECE_ROOT = z
  .object({ outcome: z.literal("ok"), value: absolutePathSchema })
  .parse(createDefaultPathPort({}).resolve({ path: "/install/mechanisms/eslint/CD-14" })).value;

const keywordAfterNodeStartCases = z
  .array(
    z.object({
      name: z.string(),
      fileName: repoPathSchema,
      source: z.string(),
      expectedLines: z.array(z.number()),
    }),
  )
  .parse([
    {
      name: "decorator on the line before the class keyword",
      fileName: "decorated.ts",
      source: "@sealed\nclass Alpha {}\n",
      expectedLines: [2],
    },
    {
      name: "decorated class expression",
      fileName: "decorated-expression.ts",
      source: "export const Gamma = @sealed\nclass {};\n",
      expectedLines: [2],
    },
  ]);

const loadedPlugin = eslintPluginModuleSchema.parse({ default: classAuthoringPlugin }).default;

const eslint = createDefaultEslintPort({});

const noFileText: FileTextPort = {
  read: ({ path }) => ({ outcome: "failed", error: { kind: "unreadable", path, detail: "not used" } }),
  exists: () => "absent",
  write: () => ({ outcome: "ok", value: undefined }),
};

const loadingWalkerPiece: ModuleLoaderPort = {
  load: () => Promise.resolve({ outcome: "ok", value: { check } }),
};

const walkerRunner = createWalkerRunner({
  fileText: noFileText,
  modules: loadingWalkerPiece,
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/install" }),
  parse: createDefaultParsePort({}),
});

const WALKER_CLAUSE: RunnerClause = {
  address: clauseAddressSchema.parse("CD-14#class-syntax"),
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: "/install/mechanisms/walker/CD-14",
  settings: { module: "class-syntax.ts" },
};

describe("CD-14 class-syntax anchors in the walker and the ESLint piece", () => {
  it.each(
    keywordAfterNodeStartCases,
  )("anchors at the class keyword on the same line in both mechanisms for the case $name", async (anchorCase) => {
    expect({
      walker: await walkerRunner.conform({ clause: WALKER_CLAUSE, cases: [anchorCase] }),
      eslint: await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "rin-discipline",
        rule: "no-class-authoring",
        cases: [anchorCase],
      }),
    }).toEqual({
      walker: {
        outcome: "ok",
        value: [{ caseName: anchorCase.name, flaggedLines: anchorCase.expectedLines }],
      },
      eslint: {
        outcome: "ok",
        value: [{ caseName: anchorCase.name, flaggedLines: anchorCase.expectedLines }],
      },
    });
  });
});
