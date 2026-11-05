// covers: file:core/tools/aidlc-plugin-emit.ts, file:core/tools/aidlc-sensor-projection.ts
import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { buildPluginProjection, type PluginTarget } from "../../core/tools/aidlc-plugin-emit.ts";

const root = mkdtempSync(join(tmpdir(), "aidlc-sensor-emission-"));
const pluginRoot = join(root, "source");
const templateHooksDir = resolve(import.meta.dir, "../../scripts/plugin-hooks-template");
mkdirSync(join(pluginRoot, ".aidlc-plugin"), { recursive: true });
mkdirSync(join(pluginRoot, "sensors"));
mkdirSync(join(pluginRoot, "knowledge"));
writeFileSync(join(pluginRoot, ".aidlc-plugin/plugin.json"), JSON.stringify({ name: "sensor-probe", version: "1.0.0", aidlc: { contributes: { sensors: "sensors/", knowledge: "knowledge/" } } }));
writeFileSync(join(pluginRoot, "sensors/aidlc-probe.md"), "command: {{INVOKE}} engine sensor-probe\r\npath: {{HARNESS_DIR}}/tools/probe.ts\r\n");
writeFileSync(join(pluginRoot, "knowledge/unchanged.md"), "Do not project {{HARNESS_DIR}} here.\r\n");
const target: PluginTarget = {
  harnessName: "codex", harnessLeaf: ".codex", manifestDir: ".codex-plugin", kind: "store", installRoots: [".codex"],
  sensorProjection: {
    harness: "codex", harnessDir: ".codex", rulesSubdir: "aidlc-rules",
    invocation: "bun .codex/tools/aidlc.ts", memoryRoot: "aidlc/spaces/default/memory",
  },
};
afterAll(() => { rmSync(root, { recursive: true, force: true }); });

test("shared emitter writes projected sensor bytes and preserves non-sensor content", () => {
  const outDir = join(root, "valid");
  buildPluginProjection({ pluginRoot, target, outDir, templateHooksDir });
  expect(readFileSync(join(outDir, "sensors/aidlc-probe.md"), "utf8")).toBe(
    "command: bun .codex/tools/aidlc.ts engine sensor-probe\r\npath: .codex/tools/probe.ts\r\n",
  );
  expect(readFileSync(join(outDir, "knowledge/unchanged.md"), "utf8")).toBe("Do not project {{HARNESS_DIR}} here.\r\n");
  expect(readFileSync(join(outDir, "hooks/compose.ts"))).toEqual(readFileSync(join(templateHooksDir, "compose.ts")));
});

test("missing sensor context refuses before fresh output or replacement of owned output", () => {
  const missing = { ...target, sensorProjection: undefined };
  const fresh = join(root, "missing");
  expect(() => buildPluginProjection({ pluginRoot, target: missing, outDir: fresh, templateHooksDir })).toThrow("context: invalid-input");
  expect(existsSync(fresh)).toBe(false);
  const outDir = join(root, "owned");
  buildPluginProjection({ pluginRoot, target, outDir, templateHooksDir });
  writeFileSync(join(outDir, "preserve.txt"), "keep\n");
  expect(() => buildPluginProjection({ pluginRoot, target: missing, outDir, templateHooksDir })).toThrow("context: invalid-input");
  expect(readFileSync(join(outDir, "preserve.txt"), "utf8")).toBe("keep\n");
  expect(readFileSync(join(outDir, "sensors/aidlc-probe.md"), "utf8")).toBe(
    "command: bun .codex/tools/aidlc.ts engine sensor-probe\r\npath: .codex/tools/probe.ts\r\n",
  );
});

test("used shared or target declarations refuse before replacement, unused declarations remain allowed", () => {
  const manifestPath = join(pluginRoot, ".aidlc-plugin/plugin.json");
  const sensorPath = join(pluginRoot, "sensors/aidlc-probe.md");
  const originalManifest = readFileSync(manifestPath);
  const originalSensor = readFileSync(sensorPath);
  const outDir = join(root, "declared");
  buildPluginProjection({ pluginRoot, target, outDir, templateHooksDir });
  writeFileSync(join(outDir, "preserve.txt"), "keep\n");
  try {
    writeFileSync(sensorPath, "command: {{OPERATOR}}\r\n");
    for (const tokens of [{ "{{OPERATOR}}": "the operator" }, { harness: { codex: { "{{OPERATOR}}": "the operator" } } }]) {
      const manifest = JSON.parse(originalManifest.toString("utf8"));
      manifest.aidlc.tokens = tokens;
      writeFileSync(manifestPath, JSON.stringify(manifest));
      expect(() => buildPluginProjection({ pluginRoot, target, outDir, templateHooksDir })).toThrow("requires declared plugin token projection");
      expect(readFileSync(join(outDir, "preserve.txt"), "utf8")).toBe("keep\n");
    }
    writeFileSync(sensorPath, originalSensor);
    const manifest = JSON.parse(originalManifest.toString("utf8"));
    manifest.aidlc.tokens = { "{{UNUSED}}": "unused" };
    writeFileSync(manifestPath, JSON.stringify(manifest));
    buildPluginProjection({ pluginRoot, target, outDir, templateHooksDir });
    expect(readFileSync(join(outDir, "sensors/aidlc-probe.md"), "utf8")).toBe(
      "command: bun .codex/tools/aidlc.ts engine sensor-probe\r\npath: .codex/tools/probe.ts\r\n",
    );
  } finally {
    writeFileSync(manifestPath, originalManifest);
    writeFileSync(sensorPath, originalSensor);
  }
});
