import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../kernel/result.ts";
import { version as frameworkVersion } from "../kernel/fixtures/values.fixture.ts";
import { createBuildPackaging } from "./core-root.ts";
import { scratchHostDistributionFixture } from "./fixtures/host-distribution.fixture.ts";
import { SCRATCH_HOST, SCRATCH_HOST_DATA } from "../projection/fixtures/scratch-host.fixture.ts";
import type { ProjectedFile } from "../projection/domain/projected-file.ts";
import { hash, path } from "../kernel/fixtures/values.fixture.ts";
import { accept } from "../kernel/fixtures/accept.ts";

test("Packaging captures one build version and binds it into its stamp", () => {
  const version = mock(() => accepted("2.11.4-preview.20261109.1"));
  const packaging = createBuildPackaging(version);
  expect(version).toHaveBeenCalledTimes(1);
  expect(packaging.version).toEqual(accepted(frameworkVersion("2.11.4-preview.20261109.1")));
  expect(packaging.stamp({ kind: "text", text: 'export const AIDLC_VERSION = "2.11.3";' }))
    .toEqual(accepted({ kind: "text", text: 'export const AIDLC_VERSION = "2.11.4-preview.20261109.1";' }));
});

test("the captured source refusal is shared by version access and stamping", () => {
  const failure = { kind: "version-unstampable" as const, reason: "Invalid build version" };
  const version = mock(() => refused(failure));
  const packaging = createBuildPackaging(version);
  expect(packaging.version).toEqual(refused(failure));
  expect(packaging.stamp({ kind: "text", text: "unchanged" })).toEqual(refused(failure));
  expect(version).toHaveBeenCalledTimes(1);
});

test("a captured value passes the kernel version decoder before becoming a payload version", () => {
  expect(createBuildPackaging(() => accepted("not a version")).version)
    .toEqual({ ok: false, refusal: { kind: "invalid-framework-version", raw: "not a version" } });
});

const ZERO_HASH = hash("sha256:0000000000000000000000000000000000000000000000000000000000000000");
const versionModule: ProjectedFile = { path: path(".scratch/tools/aidlc-version.ts"),
  content: { kind: "text", text: 'export const AIDLC_VERSION = "2.11.3";' }, mode: "regular",
  origin: { kind: "runtime-data", name: "version-module" } };
const authoringFile: ProjectedFile = { path: path(".scratch/tools/data/plugin-authoring.json"),
  content: { kind: "text", text: "{}" }, mode: "regular",
  origin: { kind: "runtime-data", name: "stage-graph" } };

const packaged = async (files: readonly ProjectedFile[]) => {
  const packaging = createBuildPackaging(() => accepted("2.11.4"));
  const projection = { host: SCRATCH_HOST, files, findings: [] };
  return accept(await packaging.packageHost({ hasher: { hash: () => accepted(ZERO_HASH) },
    distribution: scratchHostDistributionFixture, hostData: SCRATCH_HOST_DATA, projection, channel: "copy" }));
};

test("the projection descriptor's bytes do not change when plugin authoring files are present", async () => {
  const bare = await packaged([versionModule]);
  const withAuthoring = await packaged([versionModule, authoringFile]);
  expect(withAuthoring.files).toEqual(expect.arrayContaining(bare.files));
  expect(withAuthoring.files).toHaveLength(bare.files.length + 1);
});
