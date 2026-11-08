import { expect, test } from "bun:test";
import { accept } from "../kernel/fixtures/accept.ts";
import { loadCoreBuild } from "./core-build-root.ts";

const request = { coreRoot: new URL("../../core/", import.meta.url),
  markdownBlocks: () => ({ lines: [] }) };

test("the production core root shares one accepted Method across host graph projections", async () => {
  const build = accept(await loadCoreBuild(request));
  const claude = accept(build.project({ name: "claude", directory: ".claude",
    memoryRoot: "aidlc/spaces/default/memory" }));
  const codex = accept(build.project({ name: "codex", directory: ".codex",
    memoryRoot: "aidlc/spaces/default/memory" }));
  expect(build.method.graph.nodes).toHaveLength(33);
  expect(build.sources.some((source) => source.path.endsWith("requirements-analysis.md"))).toBe(true);
  expect(JSON.parse(claude.graph).map((node: { slug: string }) => node.slug))
    .toEqual(build.method.graph.nodes.map((node) => node.stage));
  expect(codex.grid).toBe(claude.grid);
  expect(claude.graph).toContain(".claude/sensors/");
  expect(codex.graph).toContain(".codex/sensors/");
});

test("an invalid host target refuses before projection", async () => {
  const build = accept(await loadCoreBuild(request));
  expect(build.project({ name: "../outside", directory: ".claude", memoryRoot: "memory" }))
    .toMatchObject({ ok: false, refusal: { kind: "invalid-distribution-id" } });
  expect(build.project({ name: "claude", directory: "../outside", memoryRoot: "memory" }))
    .toMatchObject({ ok: false, refusal: { kind: "invalid-path" } });
});


test("a reader refusal reaches the build caller without a partial Method", async () => {
  const result = await loadCoreBuild({ ...request,
    markdownBlocks: () => { throw new Error("cannot decode authored blocks"); } });
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("The failing reader must refuse");
  expect(result.refusal.length).toBeGreaterThan(0);
  expect(result.refusal.every((issue) => issue.kind === "invalid-file"
    && issue.issues.includes("cannot decode authored blocks"))).toBe(true);
});
