import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../../../kernel/result.ts";
import { host } from "../../../../kernel/fixtures/values.fixture.ts";
import { accept } from "../../../../kernel/fixtures/accept.ts";
import { createRecordingTerminal } from "../../../../kernel/fixtures/terminal.fake.ts";
import { pluginId } from "../../../../workflow-definition/domain/identities.ts";
import { createPluginBuilds } from "./plugin-builds.ts";

const plugin = { plugin: accept(pluginId("test-pro")), directory: "test-pro" };
const first = host({ name: "first", directory: ".first" });
const second = host({ name: "second", directory: ".second" });
const request = { plugins: [plugin], hosts: [first, second], output: new URL("file:///dist/"),
  boundary: new URL("file:///boundary/") };

const fixture = () => {
  const emit = mock<Parameters<typeof createPluginBuilds>[0]["emit"]>(({ output }) => accepted(output));
  const catalogues = mock<Parameters<typeof createPluginBuilds>[0]["catalogues"]>(() => accepted([".first-plugin/marketplace.json"]));
  const terminal = createRecordingTerminal();
  return { emit, catalogues, terminal, build: createPluginBuilds({ emit, catalogues, terminal }) };
};

test("plugin builds visit each plugin-host pair and write catalogues once afterwards", () => {
  const { emit, catalogues, terminal, build } = fixture();
  expect(build(request)).toEqual({ ok: true, value: { emitted: [
    new URL("file:///dist/plugins/test-pro/first/"), new URL("file:///dist/plugins/test-pro/second/")],
    catalogues: [".first-plugin/marketplace.json"] } });
  expect(emit).toHaveBeenNthCalledWith(1, { plugin, host: first,
    output: new URL("file:///dist/plugins/test-pro/first/"), boundary: request.boundary });
  expect(emit).toHaveBeenNthCalledWith(2, { plugin, host: second,
    output: new URL("file:///dist/plugins/test-pro/second/"), boundary: request.boundary });
  expect(catalogues).toHaveBeenCalledTimes(1);
  expect(catalogues).toHaveBeenCalledWith({ output: new URL("file:///dist/plugins/"), hosts: [first, second] });
  expect(terminal.output()).toEqual([
    "[plugin:test-pro] emitted dist/plugins/test-pro/first/\n",
    "[plugin:test-pro] emitted dist/plugins/test-pro/second/\n",
    "[plugins] emitted dist/plugins/.first-plugin/marketplace.json\n",
  ]);
});

test("a typed kernel refusal stops later projections and all catalogue writes", () => {
  const { emit, catalogues, terminal, build } = fixture();
  emit.mockReturnValue(refused([{ kind: "invalid-path", base: "project", raw: "../outside" }]));
  expect(build(request)).toEqual({ ok: false, refusal: [{ kind: "invalid-path", base: "project", raw: "../outside" }] });
  expect(emit).toHaveBeenCalledTimes(1);
  expect(catalogues).not.toHaveBeenCalled();
  expect(terminal.output()).toEqual([]);
});

test("a shared catalogue failure remains a host-data failure", () => {
  const { catalogues, build } = fixture();
  catalogues.mockReturnValue(refused([{ kind: "render-failed", concept: "host-data", name: "plugin-catalogues", reason: "write failed" }]));
  expect(build(request)).toEqual({ ok: false, refusal: [{ kind: "render-failed", concept: "host-data", name: "plugin-catalogues", reason: "write failed" }] });
});

test("an empty plugin set still refreshes the selected host catalogues", () => {
  const { emit, catalogues, build } = fixture();
  expect(build({ ...request, plugins: [] })).toEqual({ ok: true,
    value: { emitted: [], catalogues: [".first-plugin/marketplace.json"] } });
  expect(emit).not.toHaveBeenCalled();
  expect(catalogues).toHaveBeenCalledTimes(1);
});
