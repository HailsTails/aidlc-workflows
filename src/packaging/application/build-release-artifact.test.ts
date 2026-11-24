import { expect, mock, test } from "bun:test";
import { brand } from "../../kernel/brand.ts";
import { accepted, refused } from "../../kernel/result.ts";
import { distribution, hash, path, version } from "../../kernel/fixtures/values.fixture.ts";
import type { ArchiveEntry } from "../domain/artifact.ts";
import type { Payload } from "../domain/payload.ts";
import { claudeCopyPayloadFixture } from "../fixtures/claude-payload.fixture.ts";
import type { ArtifactWriter } from "./ports.ts";
import { createBuildReleaseArtifact } from "./build-release-artifact.ts";

const digest = hash("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
const basicPayload = (): Payload => ({ ...claudeCopyPayloadFixture, files: [{
  path: path(".claude/data.txt"), hash: digest, content: { kind: "text", text: "plain" },
  mode: "executable", origin: { kind: "version-stamp" },
}] });

test("archives payload content and modes under runtime/host and appends plugin files", async () => {
  const write = mock<ArtifactWriter["write"]>(async () => accepted(digest));
  const release = createBuildReleaseArtifact({ writer: { write }, omissions: { omitted: () => [] } });
  expect(await release.build({ name: "runtime.tar.gz", format: "tar.gz", payloads: [basicPayload()], additions: [{
    entry: brand<ArchiveEntry>("plugins/demo/.catalogue/data.bin"),
    content: { kind: "bytes", bytes: new Uint8Array([0, 255]) }, mode: "regular",
  }] })).toEqual(accepted({ name: "runtime.tar.gz", format: "tar.gz", version: version("2.12.0"), channel: "copy",
    distributions: [distribution("claude")], digest,
    entries: [brand<ArchiveEntry>("runtime/claude/.claude/data.txt"), brand<ArchiveEntry>("plugins/demo/.catalogue/data.bin")] }));
  expect(write).toHaveBeenCalledWith({ name: "runtime.tar.gz", format: "tar.gz", files: [{
    entry: brand<ArchiveEntry>("runtime/claude/.claude/data.txt"), content: { kind: "text", text: "plain" }, mode: "executable",
  }, { entry: brand<ArchiveEntry>("plugins/demo/.catalogue/data.bin"),
    content: { kind: "bytes", bytes: new Uint8Array([0, 255]) }, mode: "regular" }] });
});

test("only copy payloads use the one injected omission policy", async () => {
  const write = mock<ArtifactWriter["write"]>(async () => accepted(digest));
  const omitted = mock(() => [path(".claude/data.txt")]);
  const release = createBuildReleaseArtifact({ writer: { write }, omissions: { omitted } });
  expect(await release.build({ name: "copy.tar.gz", format: "tar.gz", payloads: [basicPayload()], additions: [] }))
    .toEqual(accepted({ name: "copy.tar.gz", format: "tar.gz", version: version("2.12.0"), channel: "copy",
      distributions: [distribution("claude")], digest, entries: [] }));
  expect(omitted).toHaveBeenCalledWith(basicPayload());
  expect(write).toHaveBeenCalledWith({ name: "copy.tar.gz", format: "tar.gz", files: [] });
});

test("native payload files cannot be suppressed by the copy omission policy", async () => {
  const write = mock<ArtifactWriter["write"]>(async () => accepted(digest));
  const omitted = mock(() => [path(".claude/data.txt")]);
  const release = createBuildReleaseArtifact({ writer: { write }, omissions: { omitted } });
  expect(await release.build({ name: "native.tar.gz", format: "tar.gz",
    payloads: [{ ...basicPayload(), channel: "native" }], additions: [] })).toEqual(accepted({
    name: "native.tar.gz", format: "tar.gz", version: version("2.12.0"), channel: "native",
    distributions: [distribution("claude")], digest, entries: [brand<ArchiveEntry>("runtime/claude/.claude/data.txt")],
  }));
  expect(omitted).not.toHaveBeenCalled();
});

test("an empty release refuses instead of inventing a version or channel", async () => {
  const write = mock<ArtifactWriter["write"]>(async () => accepted(digest));
  expect(await createBuildReleaseArtifact({ writer: { write }, omissions: { omitted: () => [] } })
    .build({ name: "empty.tar.gz", format: "tar.gz", payloads: [], additions: [] }))
    .toEqual(refused([{ kind: "no-payloads" }]));
  expect(write).not.toHaveBeenCalled();
});

test("mixed versions refuse before any archive is written", async () => {
  const write = mock<ArtifactWriter["write"]>(async () => accepted(digest));
  expect(await createBuildReleaseArtifact({ writer: { write }, omissions: { omitted: () => [] } })
    .build({ name: "mixed.tar.gz", format: "tar.gz", payloads: [basicPayload(),
      { ...basicPayload(), version: version("2.13.0") }], additions: [] }))
    .toEqual(refused([{ kind: "mixed-versions", versions: [version("2.12.0"), version("2.13.0")] }]));
  expect(write).not.toHaveBeenCalled();
});

test("mixed channels refuse before any archive is written", async () => {
  const write = mock<ArtifactWriter["write"]>(async () => accepted(digest));
  expect(await createBuildReleaseArtifact({ writer: { write }, omissions: { omitted: () => [] } })
    .build({ name: "mixed.tar.gz", format: "tar.gz", payloads: [basicPayload(),
      { ...basicPayload(), channel: "native" }], additions: [] }))
    .toEqual(refused([{ kind: "mixed-channels", channels: ["copy", "native"] }]));
  expect(write).not.toHaveBeenCalled();
});

test("a repeated host/channel payload refuses before any archive is written", async () => {
  const write = mock<ArtifactWriter["write"]>(async () => accepted(digest));
  expect(await createBuildReleaseArtifact({ writer: { write }, omissions: { omitted: () => [] } })
    .build({ name: "duplicate.tar.gz", format: "tar.gz", payloads: [basicPayload(), basicPayload()], additions: [] }))
    .toEqual(refused([{ kind: "duplicate-payload", distribution: distribution("claude"), channel: "copy" }]));
  expect(write).not.toHaveBeenCalled();
});

test("an archive writer refusal stays failure data", async () => {
  const write = mock<ArtifactWriter["write"]>(async () => refused({ kind: "archive-not-written",
    name: "runtime.tar.gz", reason: "disk full" }));
  expect(await createBuildReleaseArtifact({ writer: { write }, omissions: { omitted: () => [] } })
    .build({ name: "runtime.tar.gz", format: "tar.gz", payloads: [basicPayload()], additions: [] }))
    .toEqual(refused([{ kind: "archive-not-written", name: "runtime.tar.gz", reason: "disk full" }]));
});
