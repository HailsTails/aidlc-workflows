import { accept } from "../../kernel/fixtures/accept.ts";
import { expect, test } from "bun:test";
import { methodSource } from "../fixtures/method-source.fixture.ts";
import { readRule } from "./read-rule.ts";

const source = { owner: { kind: "core" } as const,
  path: methodSource({ kind: "rule", within: "phases/inception.md" }) };

test("rules use a method identity independent of their installed host path", () => {
  const admission = accept(readRule({ source, raw: "# Inception\n", layer: {
    kind: "phase", phase: "inception" } }));
  expect<string>(admission.id).toBe("phases/inception");
  expect(admission.source).toBe(source.path);
  expect(admission.text).toBe("# Inception\n");
});
