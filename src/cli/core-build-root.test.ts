import { methodSource } from "../workflow-definition/fixtures/method-source.fixture.ts";
import { expect, test } from "bun:test";
import { accept } from "../kernel/fixtures/accept.ts";
import { loadCoreBuild } from "./core-build-root.ts";

const request = { coreRoot: new URL("../../core/", import.meta.url),
  markdownBlocks: () => ({ lines: [] }) };

test("the production core root projects one accepted Method for two hosts", async () => {
  const build = accept(await loadCoreBuild(request));
  const claude = accept(build.project({ name: "claude", directory: ".claude",
    memoryRoot: "aidlc/spaces/default/memory" }));
  const codex = accept(build.project({ name: "codex", directory: ".codex",
    memoryRoot: "aidlc/spaces/default/memory" }));
  expect(build.method.graph.nodes).toHaveLength(33);
  expect(build.sources).toContainEqual(expect.objectContaining({
    path: "aidlc-common/stages/inception/requirements-analysis.md" }));
  expect(JSON.parse(claude.graph)).toHaveLength(33);
  expect(JSON.parse(claude.graph)[0]).toMatchObject({ slug: "workspace-scaffold", number: "0.1" });
  expect(JSON.parse(codex.grid)).toMatchObject({ feature: { stages: {
    "requirements-analysis": "EXECUTE" } } });
  expect(claude.graph).toContain(".claude/sensors/");
  expect(codex.graph).toContain(".codex/sensors/");
});

test("an invalid host target refuses before projection", async () => {
  const build = accept(await loadCoreBuild(request));
  expect(build.project({ name: "../outside", directory: ".claude", memoryRoot: "memory" }))
    .toEqual({ ok: false, refusal: { kind: "invalid-distribution-id", raw: "../outside" } });
  expect(build.project({ name: "claude", directory: "../outside", memoryRoot: "memory" }))
    .toEqual({ ok: false, refusal: { kind: "invalid-path", base: "project", raw: "../outside" } });
});

test("a malformed authored file refuses without a partial build", async () => {
  expect(await loadCoreBuild({ ...request,
    coreRoot: new URL("../workflow-definition/fixtures/refused-core/", import.meta.url) }))
    .toEqual({ ok: false, refusal: [{ kind: "invalid-file", location: {
      kind: "method-source", owner: { kind: "core" }, path: methodSource({ kind: "scope", within: "aidlc-invalid.md" }) },
      issues: ["Missing YAML frontmatter"] }] });
});
