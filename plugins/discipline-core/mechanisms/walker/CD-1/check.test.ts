import { expect, test } from "vitest";
import { z } from "zod";
import { repoPathSchema, type RepoPath } from "../../../core/values/repo-path.ts";
import type { TypeScriptRepository } from "../runner/legacy-source.ts";
import { createDefaultParsePort, type SyntaxNode, type SyntaxTree } from "../runner/typescript-parse.ts";
import type { ParsedSource } from "../runner/walker-check.ts";
import legacyCases from "./legacy-cases.json" with { type: "json" };
import { check } from "./check.ts";

const cases = z.array(z.object({
  name: z.string(),
  files: z.record(repoPathSchema, z.string()),
  expected: z.array(z.object({ file: repoPathSchema, line: z.number(), snippet: z.string() })),
})).parse(legacyCases);

test.each(cases)("preserves legacy CD-1 results for $name", (legacyCase) => {
  const parse = createDefaultParsePort({});
  const files = Object.keys(legacyCase.files).sort().map((file) => repoPathSchema.parse(file));
  const parsedFiles = new Map<RepoPath, ParsedSource<SyntaxTree, SyntaxNode>>();
  const repository: TypeScriptRepository = {
    syntaxApi: parse.syntaxApi,
    files,
    trackedPaths: files,
    exists: ({ file }) => files.includes(file) ? "present" : "absent",
    readText: ({ file }) => ({ outcome: "ok", value: z.string().parse(legacyCase.files[file]) }),
    parseFile: ({ file }) => {
      const cached = parsedFiles.get(file);
      if (cached !== undefined) {
        return { outcome: "ok", value: cached };
      }
      const source = z.string().parse(legacyCase.files[file]);
      const tree = parse.parse({ fileName: file, source });
      const nodes: SyntaxNode[] = [];
      const collect = (node: SyntaxNode): void => {
        nodes.push(node);
        parse.children({ node }).forEach(collect);
      };
      parse.children({ node: tree }).forEach(collect);
      const parsed = { source, tree, nodes };
      parsedFiles.set(file, parsed);
      return { outcome: "ok", value: parsed };
    },
  };
  if (check.kind !== "repository") {
    throw new Error("Expected a repository check");
  }
  const findings = check.inspect({ repository, settings: {} });
  expect(findings.outcome).toBe("ok");
  if (findings.outcome === "ok") {
    expect(findings.value.map(({ file, anchor, snippet }) => ({ file, line: anchor.line, snippet })))
      .toEqual(legacyCase.expected);
  }
});
