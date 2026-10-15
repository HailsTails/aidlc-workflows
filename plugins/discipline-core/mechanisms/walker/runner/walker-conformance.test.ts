import { describe, expect, it } from "vitest";
import { z } from "zod";
import { checkConformance } from "../../../core/conformance/conformance.ts";
import { type RunnerClause, runnerModuleSchema } from "../../../core/mechanism-port/runner-module-schema.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import * as walkerRunnerModule from "./runner.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const ruleSetTexts = import.meta.glob(["./rules/CD-14/discipline.json", "./mechanisms/walker/CD-14/piece.json"], {
  base: "../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const sourceCaseSchema = z.object({
  name: z.string(),
  fileName: repoPathSchema,
  source: z.string(),
  expectedLines: z.array(z.number()),
});

const classSyntaxDefinition = z
  .object({
    id: z.literal("class-syntax"),
    anchor: z.object({ kind: z.literal("keyword"), keyword: z.string() }),
    cases: z.object({ flag: z.array(sourceCaseSchema), allow: z.array(sourceCaseSchema) }),
  })
  .parse(
    z
      .object({ clauses: z.tuple([z.unknown(), z.object({ kind: z.literal("judgement") }).loose()]) })
      .parse(JSON.parse(z.string().parse(ruleSetTexts["./rules/CD-14/discipline.json"]))).clauses[0],
  );

const classSyntaxSettings = z
  .object({ clauses: z.tuple([z.object({ clause: z.literal("class-syntax"), settings: z.unknown() })]) })
  .parse(JSON.parse(z.string().parse(ruleSetTexts["./mechanisms/walker/CD-14/piece.json"]))).clauses[0].settings;

const CLASS_SYNTAX_CLAUSE: RunnerClause = {
  address: clauseAddressSchema.parse("CD-14#class-syntax"),
  anchor: classSyntaxDefinition.anchor,
  pieceRoot: `${import.meta.dirname}/../CD-14`,
  settings: classSyntaxSettings,
};

const walkerRunner = z.object({ runner: runnerModuleSchema }).parse(walkerRunnerModule).runner;

describe("the walker runner, loaded as core loads it, conforms to CD-14 class-syntax's shared cases read as build-time raw modules (CD-47: the shipped runner and its piece are the assertion's subject; nothing is spawned or written)", () => {
  it("has no conformance failure over every shared flag and allow case", async () => {
    expect(
      await checkConformance({
        clause: CLASS_SYNTAX_CLAUSE,
        cases: [...classSyntaxDefinition.cases.flag, ...classSyntaxDefinition.cases.allow],
        runner: walkerRunner,
      }),
    ).toEqual({ outcome: "ok", value: [] });
  });
});
