import { expect, mock, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { accepted, refused } from "../../kernel/result.ts";
import { distribution as distributionId, hash, path } from "../../kernel/fixtures/values.fixture.ts";
import { SCRATCH_HOST, SCRATCH_HOST_DATA } from "../../projection/fixtures/scratch-host.fixture.ts";
import { claudeCopyPayloadFixture } from "../fixtures/claude-payload.fixture.ts";
import { scratchHostDistributionFixture } from "../fixtures/host-distribution.fixture.ts";
import { createLegacyPayloadMetadata } from "./legacy-payload-metadata.ts";

const hasher = { hash: () => accepted(hash(
  "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")) };

const settingsIntegration = () => ({ path: path(".vscode/settings.json"),
  policy: "jsonc-settings" as const, presence: "required" as const });
const distribution = () => ({ ...scratchHostDistributionFixture, layout: {
  ...scratchHostDistributionFixture.layout, rootIntegrations: [settingsIntegration()],
} });
const file = (name: string, text: string) => ({ path: path(name),
  hash: hash("sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"),
  origin: { kind: "version-stamp" as const },
  mode: "regular" as const, content: { kind: "text" as const, text } });
const metadataPayload = () => ({ ...claudeCopyPayloadFixture, descriptor: {
  ...claudeCopyPayloadFixture.descriptor, host: { ...claudeCopyPayloadFixture.descriptor.host,
    directory: path(".scratch") }, layout: distribution().layout,
}, files: [file(".scratch/SKILL.md", "Skill"), file("aidlc/active-space", "default\n"),
  file(".vscode/settings.json", "{\n  // keep bytes\n}\n")] });
const originalProjection = () => ({ host: SCRATCH_HOST, files: [], findings: [] });
const metadataReader = () => createLegacyPayloadMetadata({ projection: originalProjection(), copy: null, hasher, distribution: distribution(), hostData: SCRATCH_HOST_DATA,
  onboarding: path(".scratch/SKILL.md") });

test("schema-one descriptor and stamp preserve exact serialization and exclude root-only directories", () => {
  const files = accept(metadataReader().files(metadataPayload()));
  expect(files).toHaveLength(2);
  expect(files[0]?.path).toEqual(path(".scratch/tools/data/aidlc-projection.json"));
  expect(files[0]?.content).toEqual({ kind: "text", text: `{
  "schemaVersion": 1,
  "distribution": "claude",
  "productName": "Scratch",
  "configNextStep": "open Scratch in this project and run /aidlc",
  "harnessDir": ".scratch",
  "onboarding": ".scratch/SKILL.md",
  "managedDirectories": [
    ".scratch",
    "aidlc"
  ],
  "rootIntegrations": [
    {
      "path": ".vscode/settings.json",
      "policy": "whole-file",
      "extendedPolicy": "jsonc-settings"
    }
  ]
}
` });
  expect(files[1]?.path).toEqual(path(".scratch/tools/data/aidlc-stamp.json"));
  expect(files[1]?.content).toEqual({ kind: "text", text: `{
  "schemaVersion": 1,
  "frameworkVersion": "2.12.0",
  "distribution": "claude",
  "harnessDir": ".scratch"
}
` });
});

test("plugin authoring files do not change descriptor bytes", () => {
  expect(metadataReader().files({ ...metadataPayload(), files: [...metadataPayload().files,
    file(".scratch/tools/data/plugin-targets.json", "targets"),
    file(".scratch/tools/data/plugin-hooks-template/hook.ts", "template"),
  ] })).toEqual(metadataReader().files(metadataPayload()));
});

test("listing, duplicate and missing root checks are refusals", () => {
  expect(createLegacyPayloadMetadata({ projection: originalProjection(), copy: null, hasher, distribution: { ...distribution(), listing: { choiceName: "bad\nline" } },
    hostData: SCRATCH_HOST_DATA }).files(metadataPayload())).toEqual({ ok: false, refusal: [
    { kind: "listing-text-not-plain", distribution: distributionId("claude") },
  ] });
  expect(createLegacyPayloadMetadata({ projection: originalProjection(), copy: null, hasher, distribution: { ...distribution(), layout: {
    ...distribution().layout, rootIntegrations: [settingsIntegration(), settingsIntegration()],
  } }, hostData: SCRATCH_HOST_DATA }).files(metadataPayload())).toEqual({ ok: false, refusal: [
    { kind: "root-integration-duplicate", path: path(".vscode/settings.json") },
  ] });
  expect(metadataReader().files({ ...metadataPayload(), files: [] })).toEqual({ ok: false, refusal: [
    { kind: "root-integration-missing", path: path(".vscode/settings.json") },
  ] });
});

test("root blocks retain the payload's binary bytes without a text round trip", () => {
  const reading = createLegacyPayloadMetadata({ projection: originalProjection(), copy: null, hasher, distribution: { ...distribution(), layout: {
    ...distribution().layout, rootIntegrations: [{ path: path("settings.json"), policy: "json-map", key: "servers",
      presence: "optional" }],
  } }, hostData: SCRATCH_HOST_DATA });
  const files = accept(reading.files({ ...metadataPayload(), files: [{ ...file("settings.json", ""),
    content: { kind: "bytes", bytes: new Uint8Array([0, 255, 10]) } }] }));
  expect(files[0]?.path).toEqual(path(".scratch/tools/data/root-blocks/settings.json"));
  expect(files[0]?.content).toEqual({ kind: "bytes", bytes: new Uint8Array([0, 255, 10]) });
});

test("a managed block preserves its root bytes and includes their current signature", () => {
  const reading = createLegacyPayloadMetadata({ projection: originalProjection(), copy: null, hasher, distribution: { ...scratchHostDistributionFixture, layout: {
    ...scratchHostDistributionFixture.layout, rootIntegrations: [{ path: path(".gitignore"),
      policy: "managed-block", marker: "gitignore", sharing: "union", presence: "required" }],
  } }, hostData: SCRATCH_HOST_DATA });
  const files = accept(reading.files({ ...metadataPayload(), files: [file(".scratch/SKILL.md", "Skill"),
    file(".gitignore", "abc")] }));
  expect(files[0]?.path).toEqual(path(".scratch/tools/data/root-blocks/gitignore"));
  expect(files[0]?.content).toEqual({ kind: "text", text: "abc" });
  expect(files[1]?.content).toEqual({ kind: "text", text: `{
  "schemaVersion": 1,
  "distribution": "claude",
  "productName": "Scratch",
  "configNextStep": "open Scratch in this project and run /aidlc",
  "harnessDir": ".scratch",
  "managedDirectories": [
    ".scratch"
  ],
  "rootIntegrations": [
    {
      "path": ".gitignore",
      "policy": "managed-block",
      "marker": "gitignore",
      "shared": "union",
      "legacySignatures": {
        "wholeFileHashes": [
          "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        ]
      }
    }
  ]
}
` });
});

test("descriptor and stamp hash refusals are both returned without partial metadata", () => {
  const reading = createLegacyPayloadMetadata({ projection: originalProjection(), copy: null, distribution: distribution(), hostData: SCRATCH_HOST_DATA,
    hasher: { hash: () => refused({ kind: "invalid-content-hash", raw: "invalid metadata digest" }) } });
  expect(reading.files(metadataPayload())).toEqual(refused([
    { kind: "invalid-content-hash", raw: "invalid metadata digest" },
    { kind: "invalid-content-hash", raw: "invalid metadata digest" },
  ]));
});

test("native metadata keeps both copy-era cases and the copy descriptor in legacy field order", () => {
  const copy = { ...metadataPayload(), files: [
    { ...file(".scratch/SKILL.md", "copy"), hash: hash("sha256:0000000000000000000000000000000000000000000000000000000000000000") },
    { ...file(".scratch/tools/data/aidlc-projection.json", "copy descriptor"),
      hash: hash("sha256:0000000000000000000000000000000000000000000000000000000000000000") },
  ] };
  const native = { ...metadataPayload(), channel: "native" as const, descriptor: { ...metadataPayload().descriptor,
    history: { priorIntegrations: [], retiredFiles: [
      { path: path(".scratch/SKILL.md"), shippedHashes: [hash("sha256:2222222222222222222222222222222222222222222222222222222222222222")] },
      { path: path(".scratch/retired.md"), shippedHashes: [hash("sha256:2222222222222222222222222222222222222222222222222222222222222222")] },
    ] },
  } };
  const files = accept(createLegacyPayloadMetadata({ projection: originalProjection(), copy, hasher, distribution: distribution(), hostData: SCRATCH_HOST_DATA,
    onboarding: path(".scratch/SKILL.md") }).files(native));
  expect(files[0]?.content).toEqual({ kind: "text", text: "{\n  \"schemaVersion\": 1,\n  \"distribution\": \"claude\",\n  \"productName\": \"Scratch\",\n  \"configNextStep\": \"open Scratch in this project and run /aidlc\",\n  \"harnessDir\": \".scratch\",\n  \"onboarding\": \".scratch/SKILL.md\",\n  \"managedDirectories\": [\n    \".scratch\",\n    \"aidlc\"\n  ],\n  \"rootIntegrations\": [\n    {\n      \"path\": \".vscode/settings.json\",\n      \"policy\": \"whole-file\",\n      \"extendedPolicy\": \"jsonc-settings\"\n    }\n  ],\n  \"retiredCopyFileHashes\": {\n    \".scratch/retired.md\": [\n      \"sha256:2222222222222222222222222222222222222222222222222222222222222222\"\n    ]\n  },\n  \"legacyManagedFileHashes\": {\n    \".scratch/SKILL.md\": [\n      \"sha256:0000000000000000000000000000000000000000000000000000000000000000\",\n      \"sha256:2222222222222222222222222222222222222222222222222222222222222222\"\n    ],\n    \".scratch/tools/data/aidlc-projection.json\": [\n      \"sha256:0000000000000000000000000000000000000000000000000000000000000000\"\n    ]\n  }\n}\n" });
});

test("explicit native absence skips copy-based root blocks and signatures", () => {
  const reading = createLegacyPayloadMetadata({ projection: originalProjection(), copy: null, hasher, hostData: SCRATCH_HOST_DATA,
    distribution: { ...scratchHostDistributionFixture, layout: { ...scratchHostDistributionFixture.layout,
      rootIntegrations: [{ path: path(".gitignore"), policy: "managed-block", marker: "gitignore", sharing: "union", presence: "required" }],
    } } });
  const files = accept(reading.files({ ...metadataPayload(), channel: "native", files: [
    file(".scratch/SKILL.md", "Skill"), file(".gitignore", "abc"),
  ] }));
  expect(files).toHaveLength(2);
  expect(files[0]?.path).toBe(path(".scratch/tools/data/aidlc-projection.json"));
  expect(files[0]?.content).toMatchObject({ kind: "text", text: expect.not.stringContaining("legacyManagedFileHashes") });
  expect(files[0]?.content).toMatchObject({ kind: "text", text: expect.not.stringContaining("retiredCopyFileHashes") });
});

test("native root-block parts keep the native root bytes before signatures are serialized", () => {
  const copy = metadataPayload();
  const reading = createLegacyPayloadMetadata({ projection: originalProjection(), copy, hasher, hostData: SCRATCH_HOST_DATA,
    distribution: { ...scratchHostDistributionFixture, layout: { ...scratchHostDistributionFixture.layout,
      rootIntegrations: [{ path: path("settings.json"), policy: "json-map", key: "servers", presence: "optional" }],
    } } });
  const files = accept(reading.files({ ...metadataPayload(), channel: "native", descriptor: { ...metadataPayload().descriptor, layout: {
    ...scratchHostDistributionFixture.layout, rootIntegrations: [{ path: path("settings.json"),
      policy: "json-map", key: "servers", presence: "optional" }],
  } }, files: [
    file(".scratch/SKILL.md", "Skill"), { ...file("settings.json", ""),
      content: { kind: "bytes", bytes: new Uint8Array([0, 255, 10]) } },
  ] }));
  expect(files[0]?.path).toBe(path(".scratch/tools/data/root-blocks/settings.json"));
  expect(files[0]?.content).toEqual({ kind: "bytes", bytes: new Uint8Array([0, 255, 10]) });
});

test("native metadata uses the prepared layout after copy-only root declarations leave", () => {
  const reading = createLegacyPayloadMetadata({ projection: originalProjection(), copy: metadataPayload(), hasher,
    distribution: distribution(), hostData: SCRATCH_HOST_DATA });
  expect(reading.files({ ...metadataPayload(), channel: "native", descriptor: { ...metadataPayload().descriptor,
    layout: { ...distribution().layout, rootIntegrations: [] } }, files: [file(".scratch/SKILL.md", "Skill")],
  })).toMatchObject({ ok: true, value: [
    { path: path(".scratch/tools/data/aidlc-projection.json"), content: { kind: "text",
      text: expect.not.stringContaining(".vscode/settings.json") } },
    { path: path(".scratch/tools/data/aidlc-stamp.json") },
  ] });
});


test("native block parts hold final bytes while their legacy signature keeps the pre-layout root", () => {
  const hashContent = mock(() => accepted(hash(
    "sha256:1111111111111111111111111111111111111111111111111111111111111111")));
  const layout = { ...scratchHostDistributionFixture.layout,
    rootIntegrations: [{ path: path("AGENTS.md"), policy: "managed-block" as const, marker: "agents",
      sharing: "exclusive" as const, presence: "required" as const }] };
  const reading = createLegacyPayloadMetadata({ copy: metadataPayload(),
    projection: { host: SCRATCH_HOST, findings: [], files: [{ path: path("AGENTS.md"),
      content: { kind: "text", text: "pre-layout onboarding" }, mode: "regular",
      origin: { kind: "rendered", concept: "onboarding", name: "AGENTS.md" } }] },
    hasher: { hash: hashContent }, distribution: { ...scratchHostDistributionFixture, layout },
    hostData: SCRATCH_HOST_DATA });
  const metadataFiles = accept(reading.files({ ...metadataPayload(), channel: "native",
    descriptor: { ...metadataPayload().descriptor, layout }, files: [file("AGENTS.md", "final native onboarding")] }));
  expect(metadataFiles[0]?.content).toEqual({ kind: "text", text: "final native onboarding" });
  expect(metadataFiles[1]?.content).toMatchObject({ kind: "text", text: expect.stringContaining(
    '"sha256:1111111111111111111111111111111111111111111111111111111111111111"') });
  expect(hashContent).toHaveBeenCalledWith({ kind: "text", text: "pre-layout onboarding" });
});


test("a native root signature refuses a missing pre-layout source instead of using final bytes", () => {
  const layout = { ...scratchHostDistributionFixture.layout,
    rootIntegrations: [{ path: path("AGENTS.md"), policy: "managed-block" as const,
      marker: "agents", sharing: "exclusive" as const, presence: "required" as const }] };
  const reading = createLegacyPayloadMetadata({ projection: originalProjection(), copy: metadataPayload(),
    hasher, distribution: { ...scratchHostDistributionFixture, layout }, hostData: SCRATCH_HOST_DATA });
  expect(reading.files({ ...metadataPayload(), channel: "native", descriptor: { ...metadataPayload().descriptor, layout },
    files: [file("AGENTS.md", "final native onboarding")] }))
    .toEqual(refused([{ kind: "root-integration-missing", path: path("AGENTS.md") }]));
});
