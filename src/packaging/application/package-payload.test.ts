import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { hash, path, source } from "../../kernel/fixtures/values.fixture.ts";
import type { ProjectedFile } from "../../projection/domain/projected-file.ts";
import { claudeCopyPayloadFixture } from "../fixtures/claude-payload.fixture.ts";
import type { VersionStamp } from "./boundary-ports.ts";
import { createPackagePayload } from "./package-payload.ts";

const fixture = claudeCopyPayloadFixture;
const ZERO_HASH = hash("sha256:0000000000000000000000000000000000000000000000000000000000000000");
const stampedText: VersionStamp = () => accepted({ kind: "text", text: "stamped" });
const application = (stamp: VersionStamp = stampedText) => createPackagePayload({
  bundler: { bundle: async () => accepted([]) },
  hasher: { hash: () => ZERO_HASH },
  layouts: { layout: () => accepted(fixture.descriptor.layout) },
  history: { history: async () => accepted(fixture.descriptor.history) },
  metadata: { files: () => [] },
  stamp,
});
const versionModule = (text: string): ProjectedFile => ({ path: path(".claude/tools/aidlc-version.ts"),
  content: { kind: "text", text }, mode: "regular", availability: "always",
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
