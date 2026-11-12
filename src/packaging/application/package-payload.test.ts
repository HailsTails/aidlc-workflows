import { createScriptedToolBundler } from "../fixtures/tool-bundler.fake.ts";
import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { hash, path, source } from "../../kernel/fixtures/values.fixture.ts";
import type { ProjectedFile } from "../../projection/domain/projected-file.ts";
import { claudeCopyPayloadFixture } from "../fixtures/claude-payload.fixture.ts";
import type { ContentHasher } from "./ports.ts";
import type { VersionStamp } from "./boundary-ports.ts";
import { createPackagePayload } from "./package-payload.ts";

const fixture = claudeCopyPayloadFixture;
const ZERO_HASH = hash("sha256:0000000000000000000000000000000000000000000000000000000000000000");
const stampedText: VersionStamp = () => accepted({ kind: "text", text: "stamped" });
const application = (stamp: VersionStamp = stampedText,
  hasher: ContentHasher = { hash: () => accepted(ZERO_HASH) }) => createPackagePayload({
  bundler: { bundle: async () => accepted([]) },
  hasher,
  layouts: { layout: () => accepted(fixture.descriptor.layout) },
  history: { history: async () => accepted(fixture.descriptor.history) },
  metadata: { files: () => accepted([]) },
  stamp,
});
const versionModule = (text: string): ProjectedFile => ({ path: path(".claude/tools/aidlc-version.ts"),
  content: { kind: "text", text }, mode: "regular",
  origin: { kind: "runtime-data", name: "version-module" } });

test("packaging obtains host layout independently of Projection", async () => {
  const packaged = await application().package({ version: fixture.version, channel: "copy",
    projection: { host: fixture.descriptor.host, files: [versionModule("v")], findings: [] }, runtime: [] });
  expect(packaged).toMatchObject({ ok: true, value: { version: fixture.version, channel: "copy",
    descriptor: fixture.descriptor } });
});

test("the one version module is stamped and its hash follows the stamped bytes", async () => {
  const stamp = mock(stampedText);
  const packaged = await application(stamp).package({ version: fixture.version, channel: "copy",
    projection: { host: fixture.descriptor.host, files: [versionModule("v")], findings: [] }, runtime: [] });
  expect(stamp).toHaveBeenCalledTimes(1);
  expect(packaged).toMatchObject({ ok: true, value: { files: [{ path: path(".claude/tools/aidlc-version.ts"),
    content: { kind: "text", text: "stamped" }, hash: ZERO_HASH,
    origin: { kind: "projected", origin: { kind: "runtime-data", name: "version-module" } } }] } });
});

test("a projection with no version module is refused with the count", async () => {
  const packaged = await application().package({ version: fixture.version, channel: "copy",
    projection: { host: fixture.descriptor.host, files: [], findings: [] }, runtime: [] });
  expect(packaged).toEqual(refused([{ kind: "version-module-count", found: 0 }]));
});

test("a projection with two version modules is refused with the count", async () => {
  const second = { ...versionModule("w"), path: path(".claude/tools/other-version.ts") };
  const packaged = await application().package({ version: fixture.version, channel: "copy",
    projection: { host: fixture.descriptor.host, files: [versionModule("v"), second], findings: [] }, runtime: [] });
  expect(packaged).toEqual(refused([{ kind: "version-module-count", found: 2 }]));
});

test("a stamp refusal is the payload refusal", async () => {
  const packaged = await application(() => refused({ kind: "version-unstampable", reason: "no assignment" }))
    .package({ version: fixture.version, channel: "copy",
      projection: { host: fixture.descriptor.host, files: [versionModule("v")], findings: [] }, runtime: [] });
  expect(packaged).toEqual(refused([{ kind: "version-unstampable", reason: "no assignment" }]));
});

test("a requested runtime entry cannot be silently omitted", async () => {
  const packaged = await application().package({ version: fixture.version, channel: "copy",
    projection: { host: fixture.descriptor.host, files: [versionModule("v")], findings: [] },
    runtime: [{ name: "aidlc", compositionRoot: source("src/cli/main.ts") }] });
  expect(packaged).toMatchObject({ ok: false, refusal: [{ kind: "entry-not-bundled", entry: "aidlc",
    reason: "The bundler returned no file for this entry point." }] });
});

test("metadata refusals pass through instead of assembling a partial payload", async () => {
  const packagePayload = createPackagePayload({
    bundler: { bundle: async () => accepted([]) }, hasher: { hash: () => accepted(hash(
      "sha256:0000000000000000000000000000000000000000000000000000000000000000")) },
    stamp: stampedText, layouts: { layout: () => accepted(fixture.descriptor.layout) },
    history: { history: async () => accepted(fixture.descriptor.history) },
    metadata: { files: () => refused([{ kind: "root-integration-missing", path: path("settings.json") }]) },
  });
  expect(await packagePayload.package({ version: fixture.version, channel: "copy", runtime: [],
    projection: { host: fixture.descriptor.host, files: [versionModule("v")], findings: [] } })).toEqual({ ok: false,
    refusal: [{ kind: "root-integration-missing", path: path("settings.json") }] });
});

test("a projected content hash refusal stops before metadata assembly", async () => {
  const files = mock(() => accepted([]));
  const packagePayload = createPackagePayload({ bundler: { bundle: async () => accepted([]) },
    hasher: { hash: () => refused({ kind: "invalid-content-hash", raw: "bad digest" }) },
    stamp: stampedText, layouts: { layout: () => accepted(fixture.descriptor.layout) },
    history: { history: async () => accepted(fixture.descriptor.history) }, metadata: { files },
  });
  expect(await packagePayload.package({ version: fixture.version, channel: "copy", runtime: [],
    projection: { host: fixture.descriptor.host, findings: [], files: [{ path: path(".claude/test.md"),
      mode: "regular", content: { kind: "text", text: "projected" },
      origin: { kind: "rendered", concept: "host-data", name: "fixture" } }] },
  })).toEqual(refused([{ kind: "invalid-content-hash", raw: "bad digest" }]));
  expect(files).not.toHaveBeenCalled();
});

test("bundled content is rehashed and preserves the digester refusal", async () => {
  const entry = { name: "aidlc", compositionRoot: source("src/cli/main.ts") };
  const packagePayload = createPackagePayload({ bundler: { bundle: async () => accepted([{
    path: path(".claude/tools/lib/aidlc.js"), mode: "regular", content: { kind: "text", text: "bundle" },
    hash: hash("sha256:0000000000000000000000000000000000000000000000000000000000000000"),
    origin: { kind: "bundled-runtime", entry },
  }]) }, hasher: { hash: () => refused({ kind: "invalid-content-hash", raw: "bad bundle digest" }) },
  stamp: stampedText, layouts: { layout: () => accepted(fixture.descriptor.layout) },
  history: { history: async () => accepted(fixture.descriptor.history) }, metadata: { files: () => accepted([]) } });
  expect(await packagePayload.package({ version: fixture.version, channel: "copy", runtime: [entry],
    projection: { host: fixture.descriptor.host, files: [], findings: [] },
  })).toEqual(refused([{ kind: "invalid-content-hash", raw: "bad bundle digest" }]));
});

test("the stamped version is hashed after its contents change", async () => {
  const stampedHash = hash("sha256:1111111111111111111111111111111111111111111111111111111111111111");
  const contentHash = mock(() => accepted(ZERO_HASH)).mockReturnValueOnce(accepted(ZERO_HASH))
    .mockReturnValueOnce(accepted(stampedHash));
  const packaged = await application(stampedText, { hash: contentHash }).package({
    version: fixture.version, channel: "copy", runtime: [],
    projection: { host: fixture.descriptor.host, findings: [], files: [versionModule("raw")] },
  });
  expect(packaged).toEqual(accepted({ ...fixture, files: [{ path: path(".claude/tools/aidlc-version.ts"),
    mode: "regular", content: { kind: "text", text: "stamped" }, hash: stampedHash,
    origin: { kind: "projected", origin: { kind: "runtime-data", name: "version-module" } } }] }));
  expect(contentHash).toHaveBeenNthCalledWith(2, { kind: "text", text: "stamped" });
});

test("a stamped version hash refusal stays typed", async () => {
  const contentHash = mock<ContentHasher["hash"]>(() => accepted(ZERO_HASH))
    .mockReturnValueOnce(accepted(ZERO_HASH))
    .mockReturnValueOnce(refused({ kind: "invalid-content-hash", raw: "bad stamped digest" }));
  expect(await application(stampedText, { hash: contentHash }).package({
    version: fixture.version, channel: "copy", runtime: [],
    projection: { host: fixture.descriptor.host, findings: [], files: [versionModule("raw")] },
  })).toEqual(refused([{ kind: "invalid-content-hash", raw: "bad stamped digest" }]));
});

test("a projected version file is included and stamped", async () => {
  expect(await application().package({ version: fixture.version, channel: "copy", runtime: [],
    projection: { host: fixture.descriptor.host, findings: [], files: [{
      path: path(".claude/tools/aidlc-version.ts"), content: { kind: "text", text: "raw" }, mode: "regular",
      origin: { kind: "runtime-data", name: "version-module" },
    }] },
  })).toEqual(accepted({ ...fixture, files: [{ path: path(".claude/tools/aidlc-version.ts"),
    mode: "regular", content: { kind: "text", text: "stamped" }, hash: ZERO_HASH,
    origin: { kind: "projected", origin: { kind: "runtime-data", name: "version-module" } } }] }));
});

test("the bundler receives the projection host instead of inferring its directory from an entry", async () => {
  const bundler = createScriptedToolBundler(accepted([]));
  const packaged = await createPackagePayload({ bundler, hasher: { hash: () => accepted(ZERO_HASH) },
    layouts: { layout: () => accepted(fixture.descriptor.layout) },
    history: { history: async () => accepted(fixture.descriptor.history) },
    metadata: { files: () => accepted([]) }, stamp: stampedText,
  }).package({ version: fixture.version, channel: "copy", runtime: [],
    projection: { host: fixture.descriptor.host, files: [versionModule("v")], findings: [] } });
  expect(packaged.ok).toBe(true);
  expect(bundler.received()).toEqual([{ entries: [], channel: "copy", host: fixture.descriptor.host }]);
});
