import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../../../kernel/result.ts";
import { accept } from "../../../../kernel/fixtures/accept.ts";
import { host } from "../../../../kernel/fixtures/values.fixture.ts";
import { createRecordingTerminal } from "../../../../kernel/fixtures/terminal.fake.ts";
import { pluginId } from "../../../../workflow-definition/domain/identities.ts";
import { methodSliceFixture } from "../../../../workflow-definition/fixtures/method.fixture.ts";
import type { CoreBuild, PackageBuildRoot } from "../../../roots.ts";
import { createPluginBuildRoute } from "./plugin-route.ts";

const claude = host({ name: "claude", directory: ".claude" });
const plugin = accept(pluginId("test-pro"));
const core: CoreBuild = { method: methodSliceFixture, sources: [],
  authored: { stages: [], scopes: [], memberships: [], freeformDefaults: [], agents: [],
    rules: [], sensors: [], knowledge: [], hooks: [] }, project: () => accepted({ graph: "{}", grid: "{}" }) };

const fixture = () => {
  const terminal = createRecordingTerminal();
  const project = mock<Parameters<typeof createPluginBuildRoute>[0]["emit"]>(() => accepted(undefined));
  const loadCore = mock<PackageBuildRoot["loadCore"]>(async () => accepted(core));
  const loadPlugins = mock<PackageBuildRoot["loadPlugins"]>(async () => accepted({ method: methodSliceFixture,
    plugins: [{ plugin, directory: "test-pro" }] }));
  const route = createPluginBuildRoute({ root: { loadCore, loadPlugins }, hosts: [claude],
    emit: project, terminal, workingDirectory: new URL("file:///H:/work/") });
  return { route, terminal, project, loadCore, loadPlugins };
};

test.each([[], ["test-pro"], ["test-pro", "claude"], ["test-pro", "claude", "out", "extra"],
  ["test-pro", "claude", "--out"]])("invalid plugin build arguments print the retained usage", async (...argv) => {
  const { route, terminal, project, loadCore } = fixture();
  expect(route.verb).toEqual(["plugin", "build"]);
  expect(await route.run(argv)).toBe(1);
  expect(terminal.errors()).toEqual(["usage: package.ts plugin build <plugin> <harness> <outDir>\n"]);
  expect(project).not.toHaveBeenCalled();
  expect(loadCore).not.toHaveBeenCalled();
});

test.each([["core", 'plugin name "core" is reserved; choose a non-reserved plugin name.\n'],
  ["Bad_Name", 'invalid plugin name "Bad_Name"; use a lowercase kebab-case name.\n']])(
  "plugin name %s retains its refusal text", async (name, message) => {
    const { route, terminal, loadCore } = fixture();
    expect(await route.run([name, "claude", "out"])).toBe(1);
    expect(terminal.errors()).toEqual([message]);
    expect(loadCore).not.toHaveBeenCalled();
  });

test("unknown plugin and host messages use the admitted catalogue", async () => {
  const { route, terminal, project } = fixture();
  expect(await route.run(["missing", "claude", "out"])).toBe(1);
  expect(await route.run(["test-pro", "missing", "out"])).toBe(1);
  expect(terminal.errors()).toEqual(['unknown plugin "missing" (have: test-pro)\n',
    'unknown plugin harness "missing" (have: claude)\n']);
  expect(project).not.toHaveBeenCalled();
});

test("relative output uses the explicit working directory and the admitted reviewer set", async () => {
  const { route, terminal, project } = fixture();
  expect(await route.run(["test-pro", "claude", "out/"])).toBe(0);
  expect(project).toHaveBeenCalledWith({ plugin: { plugin, directory: "test-pro" }, host: claude,
    output: new URL("file:///H:/work/out"),
    reviewerAgents: new Set(["aidlc-product-lead-agent", "aidlc-architecture-reviewer-agent"]),
  });
  expect(terminal.errors()).toEqual([]);
  expect(terminal.output()).toEqual([]);
});

test("a projector refusal prints its original reason and returns failure", async () => {
  const { route, terminal, project } = fixture();
  project.mockReturnValue(refused("retained emitter error"));
  expect(await route.run(["test-pro", "claude", "out"])).toBe(1);
  expect(terminal.errors()).toEqual(["retained emitter error\n"]);
});

test("a core load refusal stops before reading the plugin catalogue", async () => {
  const { route, terminal, loadCore, loadPlugins } = fixture();
  loadCore.mockResolvedValue(refused([{ kind: "source-unreadable",
    location: { kind: "authored-tree", tree: "core", within: "agents/" }, code: "permission-denied" }]));
  expect(await route.run(["test-pro", "claude", "out"])).toBe(1);
  expect(terminal.errors()).toEqual(['[{"kind":"source-unreadable","location":{"kind":"authored-tree","tree":"core","within":"agents/"},"code":"permission-denied"}]\n']);
  expect(loadPlugins).not.toHaveBeenCalled();
});

const outputLocations = process.platform === "win32" ? [
  { argument: "C:\\", expected: "file:///C:/" },
  { argument: "C:\\\\", expected: "file:///C:/" },
  { argument: "\\\\fixture-host\\share\\", expected: "file://fixture-host/share/" },
  { argument: "/", expected: "file:///H:/" },
  { argument: "../out/", expected: "file:///H:/out" },
  { argument: "out\\\\", expected: "file:///H:/work/out" },
] : [
  { argument: "/", expected: "file:///" },
  { argument: "////", expected: "file:///" },
  { argument: "../out/", expected: "file:///H:/out" },
  { argument: "out///", expected: "file:///H:/work/out" },
];

test.each(outputLocations)("output $argument preserves native root semantics", async ({ argument, expected }) => {
  const current = fixture();
  expect(await current.route.run(["test-pro", "claude", argument])).toBe(0);
  expect(current.project.mock.calls[0]?.[0].output.href).toBe(expected);
  expect(current.terminal.errors()).toEqual([]);
});
