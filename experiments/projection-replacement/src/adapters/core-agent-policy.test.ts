import { expect, mock, test } from "bun:test";
import { createCoreAgentPolicyReader, type CoreAgentPolicyLocation, type CoreAgentPolicySourceOperations } from "./core-agent-policy.ts";
import type { Finding, Outcome } from "../domain/model.ts";

const location: CoreAgentPolicyLocation = { sourceRoot: "/source", basis: { source: { kind: "core", id: "framework" }, pin: "source-pin" }, binding: { harness: "claude", directory: ".claude" } };
const digest = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const authoredBytes = new Uint8Array([97, 117, 116, 104, 111, 114, 101, 100, 32, 115, 111, 117, 114, 99, 101]);
const changedBytes = new Uint8Array([97, 117, 116, 104, 111, 114, 101, 100, 32, 115, 111, 117, 114, 99, 100]);
const present: Outcome<Uint8Array | null> = { status: "ok", value: authoredBytes };
const absent: Outcome<Uint8Array | null> = { status: "ok", value: null };
const failingOperations = [{ operation: "read" }, { operation: "module" }] satisfies { readonly operation: "read" | "module" }[];
const createFixture = () => {
  const readMemoryCap = mock<(memoryDir: string) => unknown>().mockReturnValue("balanced");
  const projectTier = mock<(...nativeArguments: readonly [tier: string, harness: string, cap: string | null]) => unknown>().mockReturnValue({ model: "native-model", effort: "medium" });
  const source = {
    read: mock<CoreAgentPolicySourceOperations["read"]>().mockResolvedValue(present),
    module: mock<CoreAgentPolicySourceOperations["module"]>().mockResolvedValue({ status: "ok", value: { readMemoryCap, projectTier } }),
    digest: mock<CoreAgentPolicySourceOperations["digest"]>().mockReturnValue(digest),
  };
  return { source, readMemoryCap, projectTier };
};

test("uses the native cap and three tier projections with complete source witnesses", async () => {
  const fixture = createFixture();
  expect(await createCoreAgentPolicyReader({ source: fixture.source }).load(location)).toEqual({ status: "ok", value: {
    tierCap: "balanced", models: { explicit: "preserve", tiers: {
      judgment: { model: "native-model", effort: "medium" }, balanced: { model: "native-model", effort: "medium" }, templated: { model: "native-model", effort: "medium" },
    } },
    inputs: [{ path: "core/tools/aidlc-tiers.ts", sha256: digest }, { path: "core/memory/org.md", sha256: digest }, { path: "core/memory/team.md", sha256: digest }, { path: "core/memory/project.md", sha256: digest }],
    origins: [
      { source: { kind: "core", id: "framework" }, pin: "source-pin", path: "core/tools/aidlc-tiers.ts" },
      { source: { kind: "core", id: "framework" }, pin: "source-pin", path: "core/memory/org.md" },
      { source: { kind: "core", id: "framework" }, pin: "source-pin", path: "core/memory/team.md" },
      { source: { kind: "core", id: "framework" }, pin: "source-pin", path: "core/memory/project.md" },
    ],
  } });
  expect(fixture.readMemoryCap.mock.calls).toEqual([["/source/core/memory"]]);
  expect(fixture.projectTier.mock.calls).toEqual([["judgment", "claude", "balanced"], ["balanced", "claude", "balanced"], ["templated", "claude", "balanced"]]);
  expect(fixture.source.module.mock.calls).toEqual([[{ sourceRoot: "/source", path: "core/tools/aidlc-tiers.ts", sha256: digest }]]);
  expect(fixture.source.read.mock.calls).toEqual([
    [{ sourceRoot: "/source", path: "core/tools/aidlc-tiers.ts" }], [{ sourceRoot: "/source", path: "core/memory/org.md" }], [{ sourceRoot: "/source", path: "core/memory/team.md" }], [{ sourceRoot: "/source", path: "core/memory/project.md" }],
    [{ sourceRoot: "/source", path: "core/tools/aidlc-tiers.ts" }], [{ sourceRoot: "/source", path: "core/memory/org.md" }], [{ sourceRoot: "/source", path: "core/memory/team.md" }], [{ sourceRoot: "/source", path: "core/memory/project.md" }],
  ]);
  expect(fixture.source.digest.mock.calls).toEqual([
    [{ bytes: new Uint8Array([97, 117, 116, 104, 111, 114, 101, 100, 32, 115, 111, 117, 114, 99, 101]) }],
    [{ bytes: new Uint8Array([97, 117, 116, 104, 111, 114, 101, 100, 32, 115, 111, 117, 114, 99, 101]) }],
    [{ bytes: new Uint8Array([97, 117, 116, 104, 111, 114, 101, 100, 32, 115, 111, 117, 114, 99, 101]) }],
    [{ bytes: new Uint8Array([97, 117, 116, 104, 111, 114, 101, 100, 32, 115, 111, 117, 114, 99, 101]) }],
  ]);
});

test("missing memory files are valid and null native cap stays null at projection", async () => {
  const fixture = createFixture();
  fixture.source.read.mockResolvedValueOnce(present).mockResolvedValueOnce(absent).mockResolvedValueOnce(absent).mockResolvedValueOnce(absent)
    .mockResolvedValueOnce(present).mockResolvedValueOnce(absent).mockResolvedValueOnce(absent).mockResolvedValueOnce(absent);
  fixture.readMemoryCap.mockReturnValue(null);
  fixture.projectTier.mockReturnValue({});
  expect(await createCoreAgentPolicyReader({ source: fixture.source }).load(location)).toEqual({ status: "ok", value: {
    tierCap: "judgment", models: { explicit: "preserve", tiers: { judgment: { model: null, effort: null }, balanced: { model: null, effort: null }, templated: { model: null, effort: null } } },
    inputs: [{ path: "core/tools/aidlc-tiers.ts", sha256: digest }], origins: [{ source: { kind: "core", id: "framework" }, pin: "source-pin", path: "core/tools/aidlc-tiers.ts" }],
  } });
  expect(fixture.projectTier.mock.calls).toEqual([["judgment", "claude", null], ["balanced", "claude", null], ["templated", "claude", null]]);
});

test("equal raw byte observations retain BOM bytes in provenance without requiring buffer identity", async () => {
  const fixture = createFixture();
  const before: Outcome<Uint8Array | null> = { status: "ok", value: new Uint8Array([239, 187, 191, 97]) };
  const after: Outcome<Uint8Array | null> = { status: "ok", value: new Uint8Array([239, 187, 191, 97]) };
  fixture.source.read.mockResolvedValueOnce(before).mockResolvedValueOnce(before).mockResolvedValueOnce(before).mockResolvedValueOnce(before)
    .mockResolvedValueOnce(after).mockResolvedValueOnce(after).mockResolvedValueOnce(after).mockResolvedValueOnce(after);
  expect((await createCoreAgentPolicyReader({ source: fixture.source }).load(location)).status).toBe("ok");
  expect(fixture.source.digest.mock.calls).toEqual([
    [{ bytes: new Uint8Array([239, 187, 191, 97]) }], [{ bytes: new Uint8Array([239, 187, 191, 97]) }],
    [{ bytes: new Uint8Array([239, 187, 191, 97]) }], [{ bytes: new Uint8Array([239, 187, 191, 97]) }],
  ]);
});

test.each([
  { basis: { source: { kind: "plugin", id: "framework" }, pin: "source-pin" }, binding: { harness: "claude", directory: ".claude" }, expected: { code: "foreign-content", subject: "core-agent-policy", detail: "declare the framework source basis before preparing core agent model policy" } },
  { basis: { source: { kind: "core", id: "other" }, pin: "source-pin" }, binding: { harness: "claude", directory: ".claude" }, expected: { code: "foreign-content", subject: "core-agent-policy", detail: "declare the framework source basis before preparing core agent model policy" } },
  { basis: { source: { kind: "core", id: "framework" }, pin: "" }, binding: { harness: "claude", directory: ".claude" }, expected: { code: "foreign-content", subject: "core-agent-policy", detail: "declare the framework source basis before preparing core agent model policy" } },
  { basis: { source: { kind: "core", id: "framework" }, pin: "source-pin" }, binding: { harness: "cursor", directory: ".cursor" }, expected: { code: "inapplicable-agent-context", subject: "core-agent-policy", detail: "the qualified core agent policy profile requires Claude with .claude" } },
] satisfies readonly { readonly basis: CoreAgentPolicyLocation["basis"]; readonly binding: CoreAgentPolicyLocation["binding"]; readonly expected: Finding }[])("refuses unqualified context before source access: $basis $binding", async ({ basis, binding, expected }) => {
  const fixture = createFixture();
  expect(await createCoreAgentPolicyReader({ source: fixture.source }).load({ sourceRoot: "/source", basis, binding })).toEqual({ status: "invalid", findings: [expected] });
  expect(fixture.source.read).not.toHaveBeenCalled();
  expect(fixture.source.module).not.toHaveBeenCalled();
});

test("a missing native tier module refuses before importing or projecting", async () => {
  const fixture = createFixture();
  fixture.source.read.mockResolvedValue(absent);
  expect(await createCoreAgentPolicyReader({ source: fixture.source }).load(location)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-agent-policy", detail: "native core/tools/aidlc-tiers.ts is required before preparing agent policy" }] });
  expect(fixture.source.module).not.toHaveBeenCalled();
  expect(fixture.readMemoryCap).not.toHaveBeenCalled();
});

test.each([null, {}, { readMemoryCap: "not callable", projectTier: "not callable" }])("rejects malformed native module capabilities: %s", async (namespace) => {
  const fixture = createFixture();
  fixture.source.module.mockResolvedValue({ status: "ok", value: namespace });
  expect(await createCoreAgentPolicyReader({ source: fixture.source }).load(location)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "core/tools/aidlc-tiers.ts", detail: "native tier module must export callable readMemoryCap and projectTier capabilities" }] });
  expect(fixture.readMemoryCap).not.toHaveBeenCalled();
});

test("module loader failure data propagates before namespace admission or native invocation", async () => {
  const fixture = createFixture();
  fixture.source.module.mockResolvedValue({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-agent-policy", detail: "native tier module could not be loaded; inspect core/tools/aidlc-tiers.ts and its imports" }] });
  expect(await createCoreAgentPolicyReader({ source: fixture.source }).load(location)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-agent-policy", detail: "native tier module could not be loaded; inspect core/tools/aidlc-tiers.ts and its imports" }] });
  expect(fixture.readMemoryCap).not.toHaveBeenCalled();
  expect(fixture.projectTier).not.toHaveBeenCalled();
  expect(fixture.source.read).toHaveBeenCalledTimes(4);
});

test.each([
  { capability: "readMemoryCap", readCalls: 0, detail: "native memory cap evaluation failed; inspect org.md, team.md and project.md tier_cap declarations" },
  { capability: "projectTier", readCalls: 1, detail: "native Claude judgment projection failed; inspect the tier module capability" },
] satisfies readonly { readonly capability: "readMemoryCap" | "projectTier"; readonly readCalls: number; readonly detail: string }[])("native invocation failure becomes bounded data at its boundary: $capability", async ({ capability, readCalls, detail }) => {
  const fixture = createFixture();
  const capabilities = { readMemoryCap: fixture.readMemoryCap, projectTier: fixture.projectTier };
  const revoked = Proxy.revocable(capabilities[capability], {});
  revoked.revoke();
  fixture.source.module.mockResolvedValue({ status: "ok", value: { ...capabilities, [capability]: revoked.proxy } });
  expect(await createCoreAgentPolicyReader({ source: fixture.source }).load(location)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-agent-policy", detail }] });
  expect(fixture.readMemoryCap).toHaveBeenCalledTimes(readCalls);
  expect(fixture.projectTier).not.toHaveBeenCalled();
});

test("prototype functions cannot masquerade as native module exports", async () => {
  const fixture = createFixture();
  const namespace: unknown = Object.create({ readMemoryCap: fixture.readMemoryCap, projectTier: fixture.projectTier });
  fixture.source.module.mockResolvedValue({ status: "ok", value: namespace });
  expect(await createCoreAgentPolicyReader({ source: fixture.source }).load(location)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "core/tools/aidlc-tiers.ts", detail: "native tier module must export callable readMemoryCap and projectTier capabilities" }] });
  expect(fixture.readMemoryCap).not.toHaveBeenCalled();
});

test("captures each native capability export once before invoking tier projections", async () => {
  const fixture = createFixture();
  const readProjectExport = mock<() => unknown>().mockReturnValue(fixture.projectTier);
  fixture.source.module.mockResolvedValue({ status: "ok", value: { readMemoryCap: fixture.readMemoryCap, get projectTier() { return readProjectExport(); } } });
  expect((await createCoreAgentPolicyReader({ source: fixture.source }).load(location)).status).toBe("ok");
  expect(readProjectExport).toHaveBeenCalledTimes(1);
  expect(fixture.projectTier.mock.calls).toEqual([["judgment", "claude", "balanced"], ["balanced", "claude", "balanced"], ["templated", "claude", "balanced"]]);
});

test.each(["future", undefined, 3])("refuses unsupported native memory cap results without projecting: %s", async (cap) => {
  const fixture = createFixture();
  fixture.readMemoryCap.mockReturnValue(cap);
  expect(await createCoreAgentPolicyReader({ source: fixture.source }).load(location)).toEqual({ status: "invalid", findings: [{ code: "invalid-tier-mapping", subject: "core/tools/aidlc-tiers.ts", detail: "native memory cap must be a supported tier or null" }] });
  expect(fixture.projectTier).not.toHaveBeenCalled();
});

test.each([null, { model: 3 }, { effort: "future" }, { model: "native-model", effort: "high", variant: "unsupported" }])("refuses unsupported Claude projection results: %s", async (projection) => {
  const fixture = createFixture();
  fixture.projectTier.mockReturnValue(projection);
  expect(await createCoreAgentPolicyReader({ source: fixture.source }).load(location)).toEqual({ status: "invalid", findings: [{ code: "invalid-tier-mapping", subject: "core/tools/aidlc-tiers.ts", detail: "native Claude judgment projection requires supported model and effort fields" }] });
});

test.each([
  { moduleAfter: changedBytes, orgAfter: authoredBytes, teamAfter: authoredBytes, projectAfter: authoredBytes },
  { moduleAfter: new Uint8Array([97, 117, 116, 104, 111, 114, 101, 100, 32, 115, 111, 117, 114, 99, 101, 0]), orgAfter: authoredBytes, teamAfter: authoredBytes, projectAfter: authoredBytes },
  { moduleAfter: authoredBytes, orgAfter: changedBytes, teamAfter: authoredBytes, projectAfter: authoredBytes },
  { moduleAfter: authoredBytes, orgAfter: authoredBytes, teamAfter: changedBytes, projectAfter: authoredBytes },
  { moduleAfter: authoredBytes, orgAfter: authoredBytes, teamAfter: authoredBytes, projectAfter: null },
])("refuses observed source drift: %s", async ({ moduleAfter, orgAfter, teamAfter, projectAfter }) => {
  const fixture = createFixture();
  fixture.source.read.mockResolvedValueOnce(present).mockResolvedValueOnce(present).mockResolvedValueOnce(present).mockResolvedValueOnce(present)
    .mockResolvedValueOnce({ status: "ok", value: moduleAfter }).mockResolvedValueOnce({ status: "ok", value: orgAfter }).mockResolvedValueOnce({ status: "ok", value: teamAfter }).mockResolvedValueOnce({ status: "ok", value: projectAfter });
  expect(await createCoreAgentPolicyReader({ source: fixture.source }).load(location)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-agent-policy", detail: "agent policy module or memory inputs changed during preparation" }] });
});

test("memory appearing after the native observation cannot acquire unrecorded provenance", async () => {
  const fixture = createFixture();
  fixture.source.read.mockResolvedValueOnce(present).mockResolvedValueOnce(absent).mockResolvedValueOnce(present).mockResolvedValueOnce(present);
  expect(await createCoreAgentPolicyReader({ source: fixture.source }).load(location)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-agent-policy", detail: "agent policy module or memory inputs changed during preparation" }] });
});

test.each(failingOperations)("converts source operation rejection to bounded failure data: %s", async ({ operation }) => {
  const fixture = createFixture();
  fixture.source[operation].mockRejectedValue("private path and secret fixture");
  expect(await createCoreAgentPolicyReader({ source: fixture.source }).load(location)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-agent-policy", detail: "agent policy source or native capability unavailable during preparation" }] });
});

test("preserves source failure data before module loading", async () => {
  const fixture = createFixture();
  fixture.source.read.mockResolvedValueOnce({ status: "invalid", findings: [{ code: "capability-gap", subject: "fixture-reader", detail: "fixture unavailable" }] });
  expect(await createCoreAgentPolicyReader({ source: fixture.source }).load(location)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "fixture-reader", detail: "fixture unavailable" }] });
  expect(fixture.source.module).not.toHaveBeenCalled();
});
