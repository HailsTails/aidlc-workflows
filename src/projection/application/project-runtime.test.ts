import { expect, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { host, path, source } from "../../kernel/fixtures/values.fixture.ts";
import { tokenBindingsFixture } from "../fixtures/token-bindings.fixture.ts";
import { projectRuntime } from "./project-runtime.ts";

const request = { host: host({ name: "native", directory: ".native" }),
  tokens: tokenBindingsFixture({ harnessDir: ".native" }), runtime: {
    files: [{ source: source("tools/run.ts"), content: { kind: "text", text: "{{INVOKE}}" } },
      { source: source("hooks/icon.bin"), content: { kind: "bytes", bytes: new Uint8Array([0, 255]) } }],
    version: { kind: "text", text: "stamped version" },
    agentTiers: { kind: "text", text: "tiers {{INVOKE}}" },
    settingsSchema: { kind: "text", text: "schema {{HARNESS_DIR}}" },
  } } as const;

test("one projection places captured runtime, stamped version and untouched generated data", () => {
  expect(projectRuntime(request)).toEqual(accepted([
    { path: path(".native/tools/run.ts"), content: { kind: "text", text: "bun .native/tools/aidlc.ts" },
      mode: "regular", availability: "always", origin: { kind: "neutral", source: source("tools/run.ts") } },
    { path: path(".native/hooks/icon.bin"), content: { kind: "bytes", bytes: new Uint8Array([0, 255]) },
      mode: "regular", availability: "always", origin: { kind: "neutral", source: source("hooks/icon.bin") } },
    { path: path(".native/tools/aidlc-version.ts"), content: { kind: "text", text: "stamped version" },
      mode: "regular", availability: "always", origin: { kind: "neutral", source: source("tools/aidlc-version.ts") } },
    { path: path(".native/tools/data/agent-tiers.json"), content: { kind: "text", text: "tiers {{INVOKE}}" },
      mode: "regular", availability: "always", origin: { kind: "runtime-data", name: "agent-tiers" } },
    { path: path(".native/tools/data/settings-schema.json"), content: { kind: "text", text: "schema {{HARNESS_DIR}}" },
      mode: "regular", availability: "always", origin: { kind: "runtime-data", name: "settings-schema" } },
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
