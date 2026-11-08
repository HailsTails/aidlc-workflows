import { expect, test } from "bun:test";
import { hash } from "../../kernel/fixtures/values.fixture.ts";
import { claudeCopyPayloadFixture } from "../fixtures/claude-payload.fixture.ts";
import { createPayloadMetadata } from "./payload-metadata.ts";

const fixture = claudeCopyPayloadFixture;
const metadataWriter = createPayloadMetadata({ hash: () =>
  hash("sha256:0000000000000000000000000000000000000000000000000000000000000000") });

test("metadata names the version and descriptor destinations", () => {
  expect(metadataWriter.files(fixture)).toMatchObject([
    { path: ".claude/tools/data/aidlc-version.json", content: { kind: "text",
      text: expect.stringContaining('"schemaVersion": 1') } },
    { path: ".claude/tools/data/aidlc-projection.json", content: { kind: "text",
      text: expect.stringContaining('"schemaVersion": 2') } },
  ]);
});

test("the descriptor keeps host identity, channel and release history", () => {
  expect(metadataWriter.files(fixture)[1]).toMatchObject({ content: {
    text: expect.stringContaining('"harnessDir": ".claude"'),
  } });
  expect(metadataWriter.files(fixture)[1]).toMatchObject({ content: {
    text: expect.stringContaining('"layout": "copy"'),
  } });
  expect(metadataWriter.files(fixture)[1]).toMatchObject({ content: {
    text: expect.stringContaining('"legacySignatures"'),
  } });
});
