import { expect, test } from "bun:test";
import { createInMemoryFileSystem } from "../../kernel/fixtures/file-system.fake.ts";
import { source } from "../../kernel/fixtures/values.fixture.ts";
import { createMemoryCompanionReading } from "./memory-companion-files.ts";

const core = new URL("file:///fixture/core/");

test("companions preserve nested hidden and binary bytes while unreadable Method documents are skipped", async () => {
  const bytes = new Uint8Array([0, 255, 10]);
  const tree = createInMemoryFileSystem({ files: {
    "file:///fixture/core/memory/templates/.gitkeep": "{{INVOKE}}",
    "file:///fixture/core/memory/data.bin": bytes,
  }, faults: { "file:///fixture/core/memory/project.md": "permission-denied" } });
  const reading = await createMemoryCompanionReading(tree)({ core });
  bytes.set([9, 8, 7]);
  expect(reading).toEqual({ ok: true, value: [
    { source: source("memory/data.bin"), content: { kind: "bytes", bytes: new Uint8Array([0, 255, 10]) } },
    { source: source("memory/templates/.gitkeep"),
      content: { kind: "bytes", bytes: new TextEncoder().encode("{{INVOKE}}") } },
  ] });
});

test("every unreadable companion is reported at its own source", async () => {
  const tree = createInMemoryFileSystem({ files: {}, faults: {
    "file:///fixture/core/memory/a.bin": "permission-denied",
    "file:///fixture/core/memory/templates/": "failed",
  } });
  expect(await createMemoryCompanionReading(tree)({ core })).toEqual({ ok: false, refusal: [
    { kind: "neutral-source-unreadable", source: source("memory/a.bin"), reason: "permission-denied" },
    { kind: "neutral-source-unreadable", source: source("memory/templates"), reason: "failed" },
  ] });
});

test("a missing memory root is a source refusal", async () => {
  expect(await createMemoryCompanionReading(createInMemoryFileSystem({ files: {} }))({ core })).toEqual({
    ok: false, refusal: [{ kind: "neutral-source-unreadable", source: source("memory"), reason: "not-found" }],
  });
});

test("an unportable companion name retains its raw spelling in a source refusal", async () => {
  const tree = createInMemoryFileSystem({ files: {
    "file:///fixture/core/memory/bad%3Aname.bin": "raw",
  } });
  expect(await createMemoryCompanionReading(tree)({ core })).toEqual({ ok: false, refusal: [{
    kind: "neutral-source-unreadable", source: source("memory"), reason: "unportable-name: memory/bad:name.bin",
  }] });
});
