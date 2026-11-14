import { expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { host } from "../../kernel/fixtures/values.fixture.ts";
import { pluginId } from "../../workflow-definition/domain/identities.ts";
import { createRecordingPluginProjector } from "./plugin-projector.fake.ts";

const identity = host({ name: "fixture", directory: ".fixture" });
const plugin = accept(pluginId("test-pro"));
const target = { format: "store", manifestDir: ".fixture-plugin", marketplaceDir: ".fixture-plugin",
  catalogue: "written" as const, installRoots: [".fixture"] };
const request = { plugin, host: identity, target, pluginFolder: new URL("file:///source/"),
  output: new URL("file:///output/"), boundary: new URL("file:///boundary/"), reviewerAgents: new Set<string>() };

test("the fake records both port operations and returns configured catalogue names", () => {
  const fake = createRecordingPluginProjector({ catalogues: [".fixture-plugin/marketplace.json"] });
  expect(fake.project(request)).toEqual({ ok: true, value: request.output });
  expect(fake.writeCatalogues({ output: request.output, targets: [{ host: identity, target }] }))
    .toEqual({ ok: true, value: [".fixture-plugin/marketplace.json"] });
  expect(fake.projections()).toEqual([request]);
  expect(fake.catalogues()).toEqual([{ output: request.output, targets: [{ host: identity, target }] }]);
});

test("the fake preserves typed failures for each independent operation", () => {
  const projectionFailure = { kind: "plugin-emit-failed", plugin, host: identity.distribution, reason: "projection failed" } as const;
  const catalogueFailure = { kind: "render-failed", concept: "host-data", name: "plugin-catalogues", reason: "catalogue failed" } as const;
  const fake = createRecordingPluginProjector({ projectionFailure, catalogueFailure });
  expect(fake.project(request)).toEqual({ ok: false, refusal: projectionFailure });
  expect(fake.writeCatalogues({ output: request.output, targets: [] })).toEqual({ ok: false, refusal: catalogueFailure });
});
