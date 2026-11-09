import { host } from "../kernel/fixtures/values.fixture.ts";
import { agent } from "../workflow-definition/fixtures/identities.fixture.ts";
import { methodSource } from "../workflow-definition/fixtures/method-source.fixture.ts";
import { expect, test } from "bun:test";
import { createInMemoryFileSystem } from "../kernel/fixtures/file-system.fake.ts";
import { accepted, refused } from "../kernel/result.ts";
import type { CoreContent } from "../workflow-definition/domain/method.ts";
import type { MethodContentDecoder } from "../workflow-definition/application/ports.ts";
import { methodSliceFixture } from "../workflow-definition/fixtures/method.fixture.ts";
import { accept } from "../kernel/fixtures/accept.ts";
import { loadCoreBuild, pluginBuildName, reviewerAgentSet, inlineAgentSet, loadHostBuildSources } from "./core-build-root.ts";

const core: CoreContent = { stages: [], agents: [], scopes: [], memberships: [], freeformDefaults: [],
  sensors: [], rules: [], knowledge: [], hooks: [] };
const decoder: MethodContentDecoder = {
  decodeCore: async () => accepted({ core, files: [] }),
  decodeContribution: async () => refused([{ kind: "core-namespace-claimed", plugin: "unused" }]),
};
const request = { coreRoot: new URL("file:///core/"), decoder,
  reader: createInMemoryFileSystem({ files: {
    "file:///core/aidlc-common/stages/.keep": "", "file:///core/agents/.keep": "",
    "file:///core/scopes/.keep": "", "file:///core/sensors/.keep": "",
    "file:///core/memory/.keep": "", "file:///core/knowledge/.keep": "",
  } }) };
test("the production core root projects one accepted Method for two hosts", async () => {
  const build = accept(await loadCoreBuild(request));
  const claude = accept(build.project({ name: "claude", directory: ".claude",
    memoryRoot: "aidlc/spaces/default/memory" }));
  const codex = accept(build.project({ name: "codex", directory: ".codex",
    memoryRoot: "aidlc/spaces/default/memory" }));
  expect(build.method.graph.nodes).toEqual([]);
  expect(build.sources).toEqual([]);
  expect(JSON.parse(claude.graph)).toEqual([]);
  expect(JSON.parse(codex.grid)).toEqual({});
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
    decoder: { ...decoder, decodeCore: async () => refused([{ kind: "invalid-file", location: {
      kind: "method-source", owner: { kind: "core" }, path: methodSource({ kind: "scope", within: "aidlc-invalid.md" }) },
      issues: ["Missing YAML frontmatter"] }]) } }))
    .toEqual({ ok: false, refusal: [{ kind: "invalid-file", location: {
      kind: "method-source", owner: { kind: "core" }, path: methodSource({ kind: "scope", within: "aidlc-invalid.md" }) },
      issues: ["Missing YAML frontmatter"] }] });
});

test("CLI plugin admission retains the identity refusal before catalog lookup", () => {
  expect(pluginBuildName("aidlc-pro")).toEqual({
    ok: false, refusal: { kind: "reserved-plugin-name", raw: "aidlc-pro" },
  });
  expect(pluginBuildName("core")).toEqual({
    ok: false, refusal: { kind: "reserved-plugin-name", raw: "core" },
  });
  expect(pluginBuildName("bad/name")).toEqual({
    ok: false, refusal: { kind: "invalid-identity", identity: "plugin", raw: "bad/name" },
  });
  expect(accept(pluginBuildName("test-pro"))).toBe<string>("test-pro");
});

test("the build boundary publishes Method participation facts", () => {
  expect([...reviewerAgentSet(methodSliceFixture)]).toEqual<readonly string[]>([
    "aidlc-product-lead-agent", "aidlc-architecture-reviewer-agent",
  ]);
  expect(inlineAgentSet(methodSliceFixture).has(agent("aidlc-product-agent"))).toBe(true);
});

test("host source paths refuse before any filesystem read", async () => {
  expect(await loadHostBuildSources({ name: "claude", directory: ".claude", root: "unread",
    copied: ["../outside"], required: [] })).toEqual({ ok: false, refusal: [
    { kind: "invalid-path", base: "source", raw: "../outside" },
  ] });
});

test("an empty authored inventory retains its admitted host identity", async () => {
  expect(await loadHostBuildSources({ name: "claude", directory: ".claude", root: "unread",
    copied: [], required: [] })).toEqual({ ok: true, value: {
      host: host({ name: "claude", directory: ".claude" }), files: [],
    } });
});
