import { expect, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { host, path, source } from "../../kernel/fixtures/values.fixture.ts";
import { tokenBindingsFixture } from "../fixtures/token-bindings.fixture.ts";
import { projectRuntime } from "./project-runtime.ts";

const request = { host: host({ name: "native", directory: ".native" }),
  compiled: { graph: "graph {{INVOKE}}", grid: "grid {{HARNESS_DIR}}" },
  tokens: tokenBindingsFixture({ harnessDir: ".native" }), runtime: {
    files: [{ source: source("tools/run.ts"), content: { kind: "text", text: "{{INVOKE}}" } },
      { source: source("hooks/icon.bin"), content: { kind: "bytes", bytes: new Uint8Array([0, 255]) } }],
    version: { kind: "text", text: "captured version" },
    agentTiers: { kind: "text", text: "tiers {{INVOKE}}" },
    settingsSchema: { kind: "text", text: "schema {{HARNESS_DIR}}" },
  } } as const;

test("one projection places captured runtime, captured version and untouched generated data", () => {
  expect(projectRuntime(request)).toEqual(accepted([
    { path: path(".native/tools/run.ts"), content: { kind: "text", text: "bun .native/tools/aidlc.ts" },
      mode: "regular", origin: { kind: "neutral", source: source("tools/run.ts") } },
    { path: path(".native/hooks/icon.bin"), content: { kind: "bytes", bytes: new Uint8Array([0, 255]) },
      mode: "regular", origin: { kind: "neutral", source: source("hooks/icon.bin") } },
    { path: path(".native/tools/aidlc-version.ts"), content: { kind: "text", text: "captured version" },
      mode: "regular", origin: { kind: "runtime-data", name: "version-module" } },
    { path: path(".native/tools/data/agent-tiers.json"), content: { kind: "text", text: "tiers {{INVOKE}}" },
      mode: "regular", origin: { kind: "runtime-data", name: "agent-tiers" } },
    { path: path(".native/tools/data/aidlc-settings.schema.json"), content: { kind: "text", text: "schema {{HARNESS_DIR}}" },
      mode: "regular", origin: { kind: "runtime-data", name: "settings-schema" } },
    { path: path(".native/tools/data/stage-graph.json"), content: { kind: "text", text: "graph {{INVOKE}}" },
      mode: "regular", origin: { kind: "runtime-data", name: "stage-graph" } },
    { path: path(".native/tools/data/scope-grid.json"), content: { kind: "text", text: "grid {{HARNESS_DIR}}" },
      mode: "regular", origin: { kind: "runtime-data", name: "scope-grid" } },
  ]));
});

test("a copied runtime file cannot silently overwrite generated data", () => {
  expect(projectRuntime({ ...request, runtime: { ...request.runtime,
    files: [{ source: source("tools/data/agent-tiers.json"), content: { kind: "text", text: "old tiers" } }],
  } })).toEqual(refused({ kind: "path-collision", path: path(".native/tools/data/agent-tiers.json"), origins: [
    { kind: "neutral", source: source("tools/data/agent-tiers.json") },
    { kind: "runtime-data", name: "agent-tiers" },
  ] }));
});
