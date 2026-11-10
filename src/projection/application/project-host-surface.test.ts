import type { DelegateShellFacts } from "./ports/delegate-shell.ts";
import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { host, path, source } from "../../kernel/fixtures/values.fixture.ts";
import { tokenBindingsFixture } from "../fixtures/token-bindings.fixture.ts";
import type { HostDataInputs, HostSurfaceProjectionRequest } from "./ports/host-surface.ts";
import { createHostSurfaceProjection } from "./project-host-surface.ts";

const facts: DelegateShellFacts = {
  engineNamespace: "fixture delegate facts", engineRoutes: [], dispatcherCommands: [], launcherGlobalFlags: [],
  workspaceNouns: [], workspaceRead: () => "other", admittedVerbs: () => ({}),
  engineRouteAdmission: () => "refused", lifecycleAdmission: () => "refused", trustedCommand: () => "trusted",
};
const projectHostSurface = createHostSurfaceProjection(facts);

const identity = host({ name: "surface-host", directory: ".surface" });
const request: HostSurfaceProjectionRequest = {
  host: identity, renderData: () => ({ productName: "Surface", configNextStep: "Open", rulesFolder: null }),
  placements: [{ source: "notice.md", destination: ".surface/notice.md" }],
  files: [{ source: source("notice.md"), content: { kind: "text", text: "Captured" } },
    { source: source("other.md"), content: { kind: "text", text: "Other concept" } }],
  prepare: accepted, tokens: tokenBindingsFixture({ harnessDir: ".surface" }), channel: "copy",
};

const descriptor = `{
  "schemaVersion": 1,
  "distribution": "surface-host",
  "productName": "Surface",
  "configNextStep": "Open",
  "name": "surface-host",
  "harnessDir": ".surface",
  "rulesSubdir": "rules"
}
`;

test("one surface projection emits host data and only declared authored placements", () => {
  const prepare = mock(accepted);
  expect(projectHostSurface({ ...request, prepare })).toEqual(accepted([
    { path: path(".surface/tools/data/harness.json"), content: { kind: "text", text: descriptor },
      mode: "regular", availability: "always",
      origin: { kind: "rendered", concept: "host-data", name: "surface-host" } },
    { path: path(".surface/notice.md"), content: { kind: "text", text: "Captured" },
      mode: "regular", availability: "always",
      origin: { kind: "harness-authored", source: source("notice.md") } },
  ]));
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(prepare).toHaveBeenCalledWith({ source: source("notice.md"),
    content: { kind: "text", text: "Captured" } });
});

test("a missing captured placement refuses its actual source", () => {
  const prepare = mock(accepted);
  expect(projectHostSurface({ ...request, files: [], prepare })).toEqual(refused({
    kind: "render-failed", concept: "host-data", name: "notice.md",
    reason: "The declared authored host file was not captured.",
  }));
  expect(prepare).not.toHaveBeenCalled();
});

test("host data and authored placement share the existing final-path collision owner", () => {
  expect(projectHostSurface({ ...request,
    placements: [{ source: "notice.md", destination: ".surface/tools/data/harness.json" }],
  })).toEqual(refused({ kind: "path-collision", path: path(".surface/tools/data/harness.json"), origins: [
    { kind: "rendered", concept: "host-data", name: "surface-host" },
    { kind: "harness-authored", source: source("notice.md") },
  ] }));
});

test("the native data renderer receives the supplied facts once before the existing serializer", () => {
  const renderData = mock((inputs: HostDataInputs) => ({
    productName: "Surface", configNextStep: "Open", rulesFolder: null,
    pluginAgentFrontmatter: {
      copy: ["name: delegate", inputs.delegateShellFacts.engineNamespace],
      native: ["name: delegate"],
    },
  }));
  expect(createHostSurfaceProjection(facts)({ ...request, placements: [], files: [], renderData })).toEqual(accepted([
    { path: path(".surface/tools/data/harness.json"), content: { kind: "text", text: descriptor },
      mode: "regular", availability: "always",
      origin: { kind: "rendered", concept: "host-data", name: "surface-host" } },
    { path: path(".surface/tools/data/plugin-agent.md"),
      content: { kind: "text", text: "---\nname: delegate\nfixture delegate facts\n---\n" },
      mode: "regular", availability: "always",
      origin: { kind: "rendered", concept: "host-data", name: "surface-host" } },
  ]));
  expect(renderData).toHaveBeenCalledTimes(1);
  expect(renderData).toHaveBeenCalledWith({ delegateShellFacts: facts });
  expect(renderData.mock.calls[0]?.[0].delegateShellFacts).toBe(facts);
});
