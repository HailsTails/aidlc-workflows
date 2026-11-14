import { afterAll, expect, test } from "bun:test";
import { createNodeFileSystem } from "../../kernel/file-system.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import { host } from "../../kernel/fixtures/values.fixture.ts";
import { pluginId } from "../../workflow-definition/domain/identities.ts";
import { createLegacyPluginProjector } from "./legacy-plugin-emit.ts";

const fileSystem = createNodeFileSystem();
const parent = new URL("../../../.cache/tmp/", import.meta.url);
accept(await fileSystem.makeFolder({ folder: parent }));
const scratch = accept(await fileSystem.makeScratchFolder({ parent }));
const projector = createLegacyPluginProjector({
  hookTemplates: new URL("../../../scripts/plugin-hooks-template/", import.meta.url),
});
const plugin = accept(pluginId("test-pro"));
const claude = host({ name: "claude", directory: ".claude" });
const target = { format: "store", manifestDir: ".claude-plugin", marketplaceDir: ".claude-plugin",
  catalogue: "written" as const, installRoots: [".claude", ".gitignore", ".mcp.json", "aidlc"] };
const output = new URL("test-pro/claude/", scratch);
const badPlugin = new URL("invalid/", scratch);
accept(await fileSystem.writeFile({ file: new URL(".aidlc-plugin/plugin.json", badPlugin),
  content: { kind: "text", text: "{invalid" } }));

afterAll(async () => {
  accept(await fileSystem.removeFolder({ folder: scratch }));
});

test("the registered bridge emits the real first-party plugin into kernel scratch", async () => {
  expect(projector.project({ plugin, host: claude, target,
    pluginFolder: new URL("../../../plugins/test-pro/", import.meta.url),
    output, boundary: scratch, reviewerAgents: new Set(["aidlc-product-lead-agent", "aidlc-architecture-reviewer-agent"]),
  })).toEqual({ ok: true, value: output });
  const manifest = accept(await fileSystem.readFile({ file: new URL(".claude-plugin/plugin.json", output) }));
  expect(manifest).toEqual({ kind: "bytes", bytes: expect.any(Uint8Array) });
  expect(await fileSystem.readFile({ file: new URL(".aidlc-plugin/plugin.json", output) }))
    .toEqual({ ok: true, value: { kind: "bytes", bytes: expect.any(Uint8Array) } });
  expect(projector.writeCatalogues({ output: scratch, targets: [{ host: claude, target }] }))
    .toEqual({ ok: true, value: [".claude-plugin/marketplace.json"] });
});

test("a thrown shipped-emitter error retains the plugin and host in its refusal", () => {
  expect(projector.project({ plugin, host: claude, target, pluginFolder: badPlugin,
    output: new URL("bad-output/", scratch), boundary: scratch, reviewerAgents: new Set(),
  })).toEqual({ ok: false, refusal: { kind: "plugin-emit-failed", plugin,
    host: claude.distribution, reason: expect.stringContaining("plugin.json") } });
});
