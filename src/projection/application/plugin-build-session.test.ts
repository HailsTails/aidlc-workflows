import { expect, mock, test } from "bun:test";
import { brand } from "../../kernel/brand.ts";
import { accepted, refused } from "../../kernel/result.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import { host } from "../../kernel/fixtures/values.fixture.ts";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import { pluginId } from "../../workflow-definition/domain/identities.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import type { AuthoredCoreMethod, AuthoredPluginBuild } from "../../workflow-definition/domain/authored-method.ts";
import type { PluginSessionPorts } from "./ports/plugin-session.ts";
import { createPluginBuildSession } from "./plugin-build-session.ts";

const core: AuthoredCoreMethod = { method: methodSliceFixture, sources: [], authored: {
  stages: [], scopes: [], memberships: [], freeformDefaults: [], agents: [], rules: [], sensors: [],
  knowledge: [], hooks: [],
} };
const first = host({ name: "first", directory: ".first" });
const second = host({ name: "second", directory: ".second" });
const plugin = { plugin: accept(pluginId("test-pro")), directory: "space plugin" };
const initial: AuthoredPluginBuild = { method: methodSliceFixture, plugins: [plugin] };
const replacement: AuthoredPluginBuild = { method: brand<Method>({ ...methodSliceFixture, stages: [] }), plugins: [] };
const emission = { plugin, host: first, output: new URL("file:///output/"), boundary: new URL("file:///boundary/") };
const target = { format: "test-format", manifestDir: ".first-plugin", marketplaceDir: ".first-plugin",
  catalogue: "written" as const, installRoots: [".first"] };
const catalogue = { output: new URL("file:///catalogues/"), hosts: [first, second] };
const methodFailure = refused([{ kind: "invalid-file" as const,
  location: { kind: "stage-pins" as const }, issues: ["retained Method failure"] }]);

const fixture = () => {
  const loadMethod = mock<PluginSessionPorts["loadMethod"]>().mockResolvedValue(accepted(initial));
  const readTarget = mock<PluginSessionPorts["readTarget"]>().mockReturnValue(accepted(target));
  const project = mock<PluginSessionPorts["projector"]["project"]>().mockReturnValue(accepted(emission.output));
  const writeCatalogues = mock<PluginSessionPorts["projector"]["writeCatalogues"]>()
    .mockReturnValue(accepted([".first-plugin/marketplace.json"]));
  const session = createPluginBuildSession({ loadMethod, readTarget, projector: { project, writeCatalogues },
    sources: new URL("file:///plugins/") });
  return { session, loadMethod, readTarget, project, writeCatalogues };
};

test("build-before-load refuses without any target or projector call", () => {
  const current = fixture();
  expect(current.session.forBuild()).toEqual(refused([{ kind: "render-failed", concept: "host-data",
    name: "plugin-build", reason: "Load the plugin Method before building its projections." }]));
  expect(current.loadMethod).not.toHaveBeenCalled();
  expect(current.readTarget).not.toHaveBeenCalled();
  expect(current.project).not.toHaveBeenCalled();
  expect(current.writeCatalogues).not.toHaveBeenCalled();
});

test("the first load refusal retains identity and leaves the session unavailable", async () => {
  const current = fixture();
  current.loadMethod.mockResolvedValue(methodFailure);
  expect(await current.session.load({ core })).toBe(methodFailure);
  expect(current.loadMethod).toHaveBeenCalledWith({ core });
  expect(current.session.forBuild()).toEqual(refused([{ kind: "render-failed", concept: "host-data",
    name: "plugin-build", reason: "Load the plugin Method before building its projections." }]));
});

test("a failed reload preserves the last successful Method and encoded plugin directory", async () => {
  const current = fixture();
  expect(await current.session.load({ core })).toEqual(accepted(initial));
  current.loadMethod.mockResolvedValue(methodFailure);
  expect(await current.session.load({ core })).toBe(methodFailure);
  expect(accept(current.session.forBuild()).emit(emission)).toEqual(accepted(emission.output));
  expect(current.project).toHaveBeenCalledWith({ plugin: plugin.plugin,
    pluginFolder: new URL("file:///plugins/space%20plugin/"), host: first, target,
    output: emission.output, boundary: emission.boundary,
    reviewerAgents: new Set(["aidlc-product-lead-agent", "aidlc-architecture-reviewer-agent"]) });
  expect(current.loadMethod).toHaveBeenCalledTimes(2);
});

test("a bound build keeps its Method after a successful reload while the next build sees the replacement", async () => {
  const current = fixture();
  await current.session.load({ core });
  const bound = accept(current.session.forBuild());
  current.loadMethod.mockResolvedValue(accepted(replacement));
  await current.session.load({ core });
  expect(bound.emit(emission)).toEqual(accepted(emission.output));
  expect(accept(current.session.forBuild()).emit(emission)).toEqual(accepted(emission.output));
  expect(bound.emit({ ...emission, host: second })).toEqual(accepted(emission.output));
  expect(current.project).toHaveBeenNthCalledWith(1, expect.objectContaining({
    reviewerAgents: new Set(["aidlc-product-lead-agent", "aidlc-architecture-reviewer-agent"]) }));
  expect(current.project).toHaveBeenNthCalledWith(2, expect.objectContaining({ reviewerAgents: new Set() }));
  expect(current.project).toHaveBeenNthCalledWith(3, expect.objectContaining({
    reviewerAgents: new Set(["aidlc-product-lead-agent", "aidlc-architecture-reviewer-agent"]) }));
  expect(current.loadMethod).toHaveBeenCalledTimes(2);
});

test("an unexpected reload exception retains its identity and the previous successful snapshot", async () => {
  const current = fixture();
  await current.session.load({ core });
  const failure = new Error("unexpected loader failure");
  current.loadMethod.mockRejectedValue(failure);
  await expect(current.session.load({ core })).rejects.toBe(failure);
  expect(accept(current.session.forBuild()).emit(emission)).toEqual(accepted(emission.output));
});

test("target refusal wins before projection and keeps its typed array identity", async () => {
  const current = fixture();
  await current.session.load({ core });
  const failure = refused([{ kind: "invalid-path" as const, base: "project" as const, raw: "../outside" }]);
  current.readTarget.mockReturnValue(failure);
  expect(accept(current.session.forBuild()).emit(emission)).toBe(failure);
  expect(current.project).not.toHaveBeenCalled();
});

test("projector refusal is wrapped once without changing the domain refusal", async () => {
  const current = fixture();
  await current.session.load({ core });
  const failure = { kind: "render-failed" as const, concept: "host-data" as const,
    name: "plugin", reason: "exact emission reason" };
  current.project.mockReturnValue(refused(failure));
  expect(accept(current.session.forBuild()).emit(emission)).toEqual(refused([failure]));
});

test("catalogue admission visits every requested host and preserves failure order without writing", async () => {
  const current = fixture();
  await current.session.load({ core });
  current.readTarget.mockReturnValueOnce(refused([{ kind: "unknown-harness", harness: "first" }]))
    .mockReturnValueOnce(refused([{ kind: "invalid-path", base: "project", raw: "../second" }]));
  expect(accept(current.session.forBuild()).catalogues(catalogue)).toEqual(refused([
    { kind: "unknown-harness", harness: "first" }, { kind: "invalid-path", base: "project", raw: "../second" },
  ]));
  expect(current.readTarget).toHaveBeenNthCalledWith(1, { host: first });
  expect(current.readTarget).toHaveBeenNthCalledWith(2, { host: second });
  expect(current.writeCatalogues).not.toHaveBeenCalled();
});

test("catalogue projection preserves host order, destination and refusal framing", async () => {
  const current = fixture();
  await current.session.load({ core });
  const view = accept(current.session.forBuild());
  expect(view.catalogues(catalogue)).toEqual(accepted([".first-plugin/marketplace.json"]));
  expect(current.writeCatalogues).toHaveBeenCalledWith({ output: catalogue.output,
    targets: [{ host: first, target }, { host: second, target }] });
  const failure = { kind: "render-failed" as const, concept: "host-data" as const,
    name: "plugin-catalogues", reason: "exact catalogue reason" };
  current.writeCatalogues.mockReturnValue(refused(failure));
  expect(view.catalogues(catalogue)).toEqual(refused([failure]));
});

test("direct projection preserves the caller's loaded catalogue reviewer identities without another session load", () => {
  const current = fixture();
  const reviewers = new Set(["catalogue-specific-reviewer"]);
  expect(current.session.project({ ...emission, reviewerAgents: reviewers })).toEqual(accepted(emission.output));
  expect(current.project).toHaveBeenCalledWith(expect.objectContaining({ reviewerAgents: reviewers }));
  expect(current.loadMethod).not.toHaveBeenCalled();
});
