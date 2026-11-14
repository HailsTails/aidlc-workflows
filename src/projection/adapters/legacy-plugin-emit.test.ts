import { expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { host } from "../../kernel/fixtures/values.fixture.ts";
import { pluginId } from "../../workflow-definition/domain/identities.ts";
import { createLegacyPluginProjector } from "./legacy-plugin-emit.ts";

const plugin = accept(pluginId("test-pro"));
const identity = host({ name: "fixture", directory: ".fixture" });
const unsupported = { host: identity, target: { format: "unsupported", manifestDir: ".fixture-plugin",
  marketplaceDir: ".fixture-plugin", catalogue: "none" as const, installRoots: [] } };
const projector = createLegacyPluginProjector({ hookTemplates: new URL("file:///H:/unused-templates/") });

test("an unsupported target is refused before the shipped emitter can touch the disk", () => {
  expect(projector.project({ ...unsupported, plugin, pluginFolder: new URL("file:///H:/unused-plugin/"),
    output: new URL("file:///H:/unused-output/"), boundary: new URL("file:///H:/unused-output/"), reviewerAgents: new Set(),
  })).toEqual({ ok: false, refusal: { kind: "plugin-emit-failed", plugin, host: identity.distribution,
    reason: expect.stringContaining("Invalid option") } });
});

test("a catalogue target error has no fabricated plugin identity", () => {
  expect(projector.writeCatalogues({ output: new URL("file:///H:/unused-output/"), targets: [unsupported] }))
    .toEqual({ ok: false, refusal: { kind: "render-failed", concept: "host-data", name: "plugin-catalogues",
      reason: expect.stringContaining("Invalid option") } });
});
