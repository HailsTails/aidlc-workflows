import { expect, test } from "bun:test";
import { accepted } from "../../kernel/result.ts";
import { hash, source } from "../../kernel/fixtures/values.fixture.ts";
import { claudeCopyPayloadFixture } from "../fixtures/claude-payload.fixture.ts";
import { createPackagePayload } from "./package-payload.ts";

const fixture = claudeCopyPayloadFixture;
const application = () => createPackagePayload({
  bundler: { bundle: async () => accepted([]) },
  hasher: { hash: () =>
    hash("sha256:0000000000000000000000000000000000000000000000000000000000000000") },
  layouts: { layout: () => accepted(fixture.descriptor.layout) },
  history: { history: async () => accepted(fixture.descriptor.history) },
  metadata: { files: () => [] },
});

test("packaging obtains host layout independently of Projection", async () => {
  const packaged = await application().package({ version: fixture.version, channel: "copy",
    projection: { host: fixture.descriptor.host, files: [], findings: [] }, runtime: [] });
  expect(packaged).toEqual(accepted({ version: fixture.version, channel: "copy",
    descriptor: fixture.descriptor, files: [] }));
});

test("a requested runtime entry cannot be silently omitted", async () => {
  const packaged = await application().package({ version: fixture.version, channel: "copy",
    projection: { host: fixture.descriptor.host, files: [], findings: [] },
    runtime: [{ name: "aidlc", compositionRoot: source("src/cli/main.ts") }] });
  expect(packaged).toMatchObject({ ok: false, refusal: [{ kind: "entry-not-bundled", entry: "aidlc",
    reason: "The bundler returned no file for this entry point." }] });
});
