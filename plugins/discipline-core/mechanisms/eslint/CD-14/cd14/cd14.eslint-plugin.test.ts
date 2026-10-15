import { describe, expect, it, test, vi } from "vitest";
import { z } from "zod";
import type { RunnerClause } from "../../../../core/mechanism-port/runner-module-schema.ts";
import type { FileTextPort } from "../../../../core/platform-ports/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../../core/platform-ports/module-loader-port.ts";
import { createPathPort } from "../../../../core/platform-ports/path-port.ts";
import { absolutePathSchema } from "../../../../core/values/absolute-path.ts";
import { clauseAddressSchema } from "../../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../../core/values/repo-path.ts";
import discipline from "../../../../rules/CD-14/discipline.json" with { type: "json" };
import { check } from "../../../walker/CD-14/class-syntax.ts";
import { createWalkerRunner } from "../../../walker/runner/create-walker-runner.ts";
import { createDefaultParsePort } from "../../../walker/runner/typescript-parse.ts";
import { createDefaultEslintPort } from "../../runner/eslint-instance.ts";
import { eslintPluginModuleSchema } from "../../runner/eslint-plugin-schema.ts";
import classAuthoringPlugin, {
  type ClassAncestor,
  type ClassDiagnosticPort,
  classDisposition,
  containerMode,
  createClassReporter,
} from "./cd14.eslint-plugin.ts";

const PIECE_ROOT = absolutePathSchema.parse("/install/mechanisms/eslint/CD-14");

const sourceCaseSchema = z.object({
  name: z.string(),
  fileName: repoPathSchema,
  source: z.string(),
  expectedLines: z.array(z.number()),
});

const sharedCases = z
  .object({
    clauses: z.tuple([
      z.object({
        cases: z.object({ flag: z.array(sourceCaseSchema), allow: z.array(sourceCaseSchema) }),
      }),
      z.object({ kind: z.literal("judgement") }),
    ]),
  })
  .parse(discipline).clauses[0].cases;

const keywordAfterNodeStartCases = z.array(sourceCaseSchema).parse([
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
  path: createPathPort({ workingDirectory: () => "/install" }),
  parse: createDefaultParsePort({}),
});

const WALKER_CLAUSE: RunnerClause = {
  address: clauseAddressSchema.parse("CD-14#class-syntax"),
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: "/install/mechanisms/walker/CD-14",
  settings: { module: "class-syntax.ts" },
};

test("runtime class declarations are reported", () => {
  expect(
    classDisposition({
      filename: "src/runtime.ts",
      kind: "declaration",
      declaration: "runtime",
      container: "runtime",
    }),
  ).toBe("report");
});

test("class expressions stay runtime syntax", () => {
  expect(
    classDisposition({
      filename: "src/runtime.ts",
      kind: "expression",
      declaration: "runtime",
      container: "runtime",
    }),
  ).toBe("report");
});

test("ambient class declarations are type-only", () => {
  expect(
    classDisposition({
      filename: "src/ambient.ts",
      kind: "declaration",
      declaration: "ambient",
      container: "runtime",
    }),
  ).toBe("allow");
});

test("declaration files are type-only", () => {
  expect(
    classDisposition({
      filename: "src/external.d.ts",
      kind: "declaration",
      declaration: "runtime",
      container: "runtime",
    }),
  ).toBe("allow");
});

test("classes enclosed by ambient modules are type-only", () => {
  expect(
    classDisposition({
      filename: "src/ambient.ts",
      kind: "declaration",
      declaration: "runtime",
      container: "ambient",
    }),
  ).toBe("allow");
});

test("the parent walk reaches an ambient module through an ordinary ancestor", () => {
  expect(
    containerMode({
      node: {
        type: "ClassBody",
        parent: { type: "TSModuleDeclaration", declare: true, parent: null },
      },
    }),
  ).toBe("ambient");
});

test("runtime namespaces do not provide an ambient exemption", () => {
  expect(containerMode({ node: { type: "TSModuleDeclaration", parent: null } })).toBe("runtime");
});

test("an unrelated declared node does not provide an ambient exemption", () => {
  expect(
    containerMode({
      node: { type: "VariableDeclaration", declare: true, parent: null },
    }),
  ).toBe("runtime");
});

test("the reporter does not publish an ambient class", () => {
  const publish = vi.fn<ClassDiagnosticPort<ClassAncestor>["publish"]>();
  const reporter = createClassReporter({
    port: { filename: "src/ambient.ts", publish },
  });
  reporter.reportClass({
    node: { type: "ClassDeclaration", declare: true, parent: null },
    kind: "declaration",
  });
  expect(publish).not.toHaveBeenCalled();
});

describe("CD-14 no-class-authoring rule through the ESLint runner's lintSourceCases", () => {
  it.each([
    ...sharedCases.flag,
    ...sharedCases.allow,
  ])("flags exactly the expected lines of the shared case $name", async (sharedCase) => {
    expect(
      await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "rin-discipline",
        rule: "no-class-authoring",
        cases: [sharedCase],
      }),
    ).toEqual({
      outcome: "ok",
      value: [{ caseName: sharedCase.name, flaggedLines: sharedCase.expectedLines }],
    });
  });

  it.each(
    keywordAfterNodeStartCases,
  )("anchors at the class keyword on the same line as the walker for the case $name", async (anchorCase) => {
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
