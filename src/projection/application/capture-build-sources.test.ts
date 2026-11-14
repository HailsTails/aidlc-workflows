import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { host, source } from "../../kernel/fixtures/values.fixture.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import type { BuildCore, BuildSourceCaptureRequest, HostSourceMember, HostSourcesRequest }
  from "./ports/build-sources.ts";
import type { AuthoredHostFile } from "../domain/host-surface.ts";
import type { MemoryCompanion, NeutralSurface, SessionSkill, SharedRuntime } from "../domain/neutral-surface.ts";
import type { ProjectionRefusal } from "../domain/projection.ts";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import { captureBuildSources } from "./capture-build-sources.ts";

const identity = host({ name: "fixture-host", directory: ".fixture" });
const member: HostSourceMember = { host: identity, projection: {
  agents: { inputs: [source("agents/a.md"), source("shared.md")] },
  skills: { inputs: [source("skills/a.md")] }, settings: { inputs: [source("settings.json"), source("shared.md")] },
  documents: { inputs: [source("documents/a.md")] }, placements: [{ source: "placement.md", destination: "placed.md" }],
} };
const core: BuildCore = { method: methodSliceFixture, sources: [] };
const neutral: NeutralSurface = { documents: [], skills: [],
  onboarding: { neutral: "neutral", harnessSkeleton: "host" } };
const sessions: readonly SessionSkill[] = [{ name: "aidlc-session-cost", files: [{ source: source("SKILL.md"),
  content: { kind: "bytes", bytes: new Uint8Array([0, 255, 10]) } }] }];
const runtime: SharedRuntime = { files: [{ source: source("tools/a.ts"),
  content: { kind: "bytes", bytes: new Uint8Array([255, 0, 10]) } }], version: { kind: "text", text: "version" },
  agentTiers: { kind: "text", text: "tiers" }, settingsSchema: { kind: "text", text: "schema" } };
const companions: readonly MemoryCompanion[] = [{ source: source("memory.md"),
  content: { kind: "text", text: "retained\r\n" } }];
const request: HostSourcesRequest = { name: "fixture-host", directory: ".fixture", root: new URL("file:///host/"),
  copied: ["copy.md", "shared.md", "copy.md"], required: ["caller.md", "shared.md"] };
const binary = { kind: "bytes" as const, bytes: new Uint8Array([0, 255]) };
const capturedFiles: readonly AuthoredHostFile[] = [
  { source: source("copy.md"), content: binary }, { source: source("shared.md"), content: binary },
  { source: source("caller.md"), content: binary }, { source: source("agents/a.md"), content: binary },
  { source: source("skills/a.md"), content: binary }, { source: source("settings.json"), content: binary },
  { source: source("documents/a.md"), content: binary }, { source: source("placement.md"), content: binary },
];
const failure: ProjectionRefusal = { kind: "render-failed", concept: "host-data",
  name: "fixture", reason: "retained failure" };

const fixture = (hosts: readonly HostSourceMember[] = [member]) => {
  type Readers = BuildSourceCaptureRequest["projection"];
  const readHostSources = mock<Readers["readHostSources"]>().mockResolvedValue(accepted(capturedFiles));
  const readNeutral = mock<Readers["readNeutral"]>().mockResolvedValue(accepted(neutral));
  const readSessionSkills = mock<Readers["readSessionSkills"]>().mockResolvedValue(accepted(sessions));
  const readRuntime = mock<Readers["readRuntime"]>().mockResolvedValue(accepted(runtime));
  const readMemoryCompanions = mock<Readers["readMemoryCompanions"]>().mockResolvedValue(accepted(companions));
  const binding: BuildSourceCaptureRequest = { hosts, core: new URL("file:///core/"),
    projection: { readHostSources, readNeutral, readSessionSkills, readRuntime, readMemoryCompanions } };
  return { capture: captureBuildSources(binding), binding,
    readHostSources, readNeutral, readSessionSkills, readRuntime, readMemoryCompanions };
};

test("caller requirements and all five declared parts retain first-seen source and required order", async () => {
  const current = fixture();
  const captured = await current.capture.readHostSources(request);
  expect(current.readHostSources).toHaveBeenCalledWith({ root: request.root, host: identity,
    sources: [source("copy.md"), source("shared.md"), source("caller.md"), source("agents/a.md"),
      source("skills/a.md"), source("settings.json"), source("documents/a.md"), source("placement.md")],
    required: [source("shared.md"), source("caller.md"), source("agents/a.md"), source("skills/a.md"),
      source("settings.json"), source("documents/a.md"), source("placement.md")] });
  expect(captured).toEqual(accepted({ host: identity, files: capturedFiles }));
  expect(current.readHostSources).toHaveBeenCalledTimes(1);
});

test("invalid host and directory admission precede source validation and any reader", async () => {
  const current = fixture();
  const invalid = { ...request, name: "Bad_Name", directory: "../bad", copied: ["../bad"] };
  expect(await current.capture.readHostSources(invalid))
    .toEqual(refused([{ kind: "invalid-distribution-id", raw: "Bad_Name" }]));
  expect(await current.capture.readHostSources({ ...request, directory: "../bad", copied: ["../source"] }))
    .toEqual(refused([{ kind: "invalid-path", base: "project", raw: "../bad" }]));
  expect(current.readHostSources).not.toHaveBeenCalled();
});

test("invalid source paths aggregate once in copied then required order before reading", async () => {
  const current = fixture([]);
  expect(await current.capture.readHostSources({ ...request, copied: ["../first", "bad\\second", "../first"],
    required: ["third:bad"] })).toEqual(refused([
    { kind: "invalid-path", base: "source", raw: "../first" },
    { kind: "invalid-path", base: "source", raw: "bad\\second" },
    { kind: "invalid-path", base: "source", raw: "third:bad" },
  ]));
  expect(current.readHostSources).not.toHaveBeenCalled();
});

test("an unregistered host or empty declaration adds no inferred requirement", async () => {
  const current = fixture([]);
  current.readHostSources.mockResolvedValue(accepted([]));
  expect(await current.capture.readHostSources({ ...request, copied: [], required: [] }))
    .toEqual(accepted({ host: identity, files: [] }));
  expect(current.readHostSources).toHaveBeenCalledWith({ root: request.root,
    host: identity, sources: [], required: [] });
});

test("required settings and placements retain refusal order after optional copies", async () => {
  const current = fixture([{ host: identity, projection: { agents: { inputs: [] }, skills: { inputs: [] },
    settings: { inputs: [source("settings.json")] }, documents: { inputs: [] },
    placements: [{ source: "placement.md", destination: "placed.md" }] } }]);
  const failures: readonly ProjectionRefusal[] = [
    { kind: "host-source-unreadable", host: identity, source: source("settings.json"),
      reason: "Host source is unreadable: permission-denied." },
    { kind: "host-source-unreadable", host: identity, source: source("placement.md"),
      reason: "Host source is unreadable: not-found." },
  ];
  current.readHostSources.mockResolvedValue(refused(failures));
  expect(await current.capture.readHostSources({ ...request, copied: ["optional.md"], required: [] }))
    .toEqual(refused(failures));
  expect(current.readHostSources).toHaveBeenCalledWith({ root: request.root, host: identity,
    sources: [source("optional.md"), source("settings.json"), source("placement.md")],
    required: [source("settings.json"), source("placement.md")] });
});

test("optional missing copies do not turn an otherwise valid capture into a refusal", async () => {
  const current = fixture([]);
  current.readHostSources.mockResolvedValue(accepted([]));
  expect(await current.capture.readHostSources({ ...request, copied: ["optional.md"], required: [] }))
    .toEqual(accepted({ host: identity, files: [] }));
  expect(current.readHostSources).toHaveBeenCalledWith({ root: request.root, host: identity,
    sources: [source("optional.md")], required: [] });
});

test("one build caches equivalent concurrent host requests and preserves captured binary bytes", async () => {
  const current = fixture();
  const first = current.capture.readHostSources(request);
  const second = current.capture.readHostSources({ ...request, copied: ["copy.md", "shared.md"] });
  expect(second).toBe(first);
  const firstReading = await first;
  const captured = accept(firstReading);
  current.readHostSources.mockResolvedValue(accepted([]));
  expect(await current.capture.readHostSources(request)).toBe(firstReading);
  expect(captured.files[0]).toEqual({ source: source("copy.md"),
    content: { kind: "bytes", bytes: new Uint8Array([0, 255]) } });
  expect(current.readHostSources).toHaveBeenCalledTimes(1);
});

test("a failed host snapshot stays failed after the file becomes readable; a new build reads afresh", async () => {
  const current = fixture([]);
  current.readHostSources.mockResolvedValue(refused([{ kind: "host-source-unreadable", host: identity,
    source: source("missing.md"), reason: "Host source is unreadable: not-found." }]));
  const required = { ...request, copied: [], required: ["missing.md"] };
  const failed = await current.capture.readHostSources(required);
  current.readHostSources.mockResolvedValue(accepted([{ source: source("missing.md"),
    content: { kind: "bytes", bytes: new Uint8Array([110, 111, 119]) } }]));
  expect(await current.capture.readHostSources(required)).toBe(failed);
  expect(current.readHostSources).toHaveBeenCalledTimes(1);
  expect(await captureBuildSources(current.binding).readHostSources(required)).toEqual(accepted({ host: identity,
    files: [{ source: source("missing.md"), content: { kind: "bytes", bytes: new Uint8Array([110, 111, 119]) } }] }));
  expect(current.readHostSources).toHaveBeenCalledTimes(2);
});

test("a different required subset is not hidden by an earlier optional capture", async () => {
  const current = fixture([]);
  current.readHostSources.mockResolvedValueOnce(accepted([])).mockResolvedValueOnce(refused([
    { kind: "host-source-unreadable", host: identity, source: source("missing.md"),
      reason: "Host source is unreadable: not-found." },
  ]));
  expect(await current.capture.readHostSources({ ...request, copied: ["missing.md"], required: [] }))
    .toEqual(accepted({ host: identity, files: [] }));
  expect(await current.capture.readHostSources({ ...request, copied: ["missing.md"], required: ["missing.md"] }))
    .toEqual(refused([{ kind: "host-source-unreadable", host: identity, source: source("missing.md"),
      reason: "Host source is unreadable: not-found." }]));
  expect(current.readHostSources).toHaveBeenCalledTimes(2);
});

test("full capture keeps neutral-session-runtime-companion order and exact returned content", async () => {
  const current = fixture();
  expect(await current.capture.captureFullHost(core)).toEqual(accepted({
    surface: { ...neutral, skills: sessions }, runtime, companions,
  }));
  expect(current.readNeutral).toHaveBeenCalledWith({ core: current.binding.core, sources: core.sources });
  expect(current.readSessionSkills).toHaveBeenCalledWith({ source: source("skills"),
    folder: new URL("skills/", current.binding.core) });
  expect(current.readRuntime).toHaveBeenCalledWith({ core: current.binding.core, method: core.method });
  expect(current.readMemoryCompanions).toHaveBeenCalledWith({ core: current.binding.core });
});

test("neutral failure stays cached before later readers", async () => {
  const current = fixture();
  current.readNeutral.mockResolvedValue(refused([failure]));
  const first = await current.capture.captureFullHost(core);
  expect(first).toEqual(refused([failure]));
  expect(await current.capture.captureFullHost(core)).toBe(first);
  expect(current.readNeutral).toHaveBeenCalledTimes(1);
  expect(current.readSessionSkills).not.toHaveBeenCalled();
  expect(current.readRuntime).not.toHaveBeenCalled();
  expect(current.readMemoryCompanions).not.toHaveBeenCalled();
});

test("sessions failure stays cached before later readers", async () => {
  const current = fixture();
  current.readSessionSkills.mockResolvedValue(refused([failure]));
  const first = await current.capture.captureFullHost(core);
  expect(first).toEqual(refused([failure]));
  expect(await current.capture.captureFullHost(core)).toBe(first);
  expect(current.readNeutral).toHaveBeenCalledTimes(1);
  expect(current.readSessionSkills).toHaveBeenCalledTimes(1);
  expect(current.readRuntime).not.toHaveBeenCalled();
  expect(current.readMemoryCompanions).not.toHaveBeenCalled();
});

test("runtime failure stays cached before later readers", async () => {
  const current = fixture();
  current.readRuntime.mockResolvedValue(refused([failure]));
  const first = await current.capture.captureFullHost(core);
  expect(first).toEqual(refused([failure]));
  expect(await current.capture.captureFullHost(core)).toBe(first);
  expect(current.readNeutral).toHaveBeenCalledTimes(1);
  expect(current.readSessionSkills).toHaveBeenCalledTimes(1);
  expect(current.readRuntime).toHaveBeenCalledTimes(1);
  expect(current.readMemoryCompanions).not.toHaveBeenCalled();
});

test("companions failure stays cached after the three prior readers", async () => {
  const current = fixture();
  current.readMemoryCompanions.mockResolvedValue(refused([failure]));
  const first = await current.capture.captureFullHost(core);
  expect(first).toEqual(refused([failure]));
  expect(await current.capture.captureFullHost(core)).toBe(first);
  expect(current.readNeutral).toHaveBeenCalledTimes(1);
  expect(current.readSessionSkills).toHaveBeenCalledTimes(1);
  expect(current.readRuntime).toHaveBeenCalledTimes(1);
  expect(current.readMemoryCompanions).toHaveBeenCalledTimes(1);
});

test("concurrent consumers share the four reads while another build gets an independent capture", async () => {
  const current = fixture();
  await Promise.all(Array.from({ length: 12 }, () => current.capture.captureFullHost(core)));
  expect(current.readNeutral).toHaveBeenCalledTimes(1);
  expect(current.readSessionSkills).toHaveBeenCalledTimes(1);
  expect(current.readRuntime).toHaveBeenCalledTimes(1);
  expect(current.readMemoryCompanions).toHaveBeenCalledTimes(1);
  await captureBuildSources(current.binding).captureFullHost(core);
  expect(current.readNeutral).toHaveBeenCalledTimes(2);
  expect(current.readSessionSkills).toHaveBeenCalledTimes(2);
  expect(current.readRuntime).toHaveBeenCalledTimes(2);
  expect(current.readMemoryCompanions).toHaveBeenCalledTimes(2);
});
