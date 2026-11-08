import { methodSource } from "./fixtures/method-source.fixture.ts";
import { expect, test } from "bun:test";
import { accept } from "../kernel/fixtures/accept.ts";
import { loadAuthoredCoreMethod } from "./core-root.ts";

const markdownBlocks = () => ({ lines: [] });

test("the Definition root loads the real core and retains captured source provenance", async () => {
  const authored = accept(await loadAuthoredCoreMethod({
    coreRoot: new URL("../../core/", import.meta.url), markdownBlocks }));
  expect(authored.method.graph.nodes).toHaveLength(33);
  expect(authored.method.graph.nodes[0]).toMatchObject({ stage: "workspace-scaffold", number: "0.1" });
  expect(authored.sources).toContainEqual(expect.objectContaining({
    path: "aidlc-common/stages/inception/requirements-analysis.md" }));
});

test("the Definition root preserves an authored reader refusal", async () => {
  expect(await loadAuthoredCoreMethod({ coreRoot: new URL("./fixtures/refused-core/", import.meta.url),
    markdownBlocks })).toEqual({ ok: false, refusal: [{ kind: "invalid-file", location: {
      kind: "method-source", owner: { kind: "core" }, path: methodSource({ kind: "scope", within: "aidlc-invalid.md" }) },
      issues: ["Missing YAML frontmatter"] }] });
});
