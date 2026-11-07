import { expect, test } from "bun:test";
import { prepareRuntimeAssets } from "./runtime-assets.ts";
import { assetDeliverySources } from "../../../../tests/unit/projection/support/__tests__/runtime-asset-delivery-fixtures.ts";
test.each([
  { binding: { harness: "claude", directory: ".claude" }, path: ".claude/tools/data/model-rates.json" },
  { binding: { harness: "cursor", directory: ".cursor" }, path: ".cursor/tools/data/model-rates.json" },
  { binding: { harness: "codex", directory: ".codex" }, path: ".codex/tools/data/model-rates.json" },
  { binding: { harness: "copilot", directory: ".aidlc" }, path: ".aidlc/tools/data/model-rates.json" },
  { binding: { harness: "opencode", directory: ".aidlc" }, path: ".aidlc/tools/data/model-rates.json" },
  { binding: { harness: "kiro", directory: ".kiro" }, path: ".kiro/tools/data/model-rates.json" },
  { binding: { harness: "kiro-ide", directory: ".kiro" }, path: ".kiro/tools/data/model-rates.json" },
] as const)("opaque runtime assets follow the explicit harness binding: %s", ({ binding, path }) => {
  const prepared = prepareRuntimeAssets({ sources: assetDeliverySources, binding, mode: 0o640 });
  expect(prepared).toEqual({ files: [{ path, bytes: new Uint8Array([255, 0, 13, 10]), mode: 0o640 }], preparation: { kind: "runtime-assets", paths: [path], inputs: [{ path: "core/tools/data/model-rates.json", sha256: "rates-source" }] } });
  expect(prepared.files[0]?.bytes).not.toBe(assetDeliverySources.assets[0]?.bytes);
});
