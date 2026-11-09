import { expect, mock, test } from "bun:test";
import { createInMemoryFileSystem } from "../../kernel/fixtures/file-system.fake.ts";
import { host, source } from "../../kernel/fixtures/values.fixture.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import { accepted, refused } from "../../kernel/result.ts";
import type { HostFileReader } from "./ports.ts";
import { createHostSurfaceReader } from "./host-source-files.ts";

const identity = host({ name: "kiro", directory: ".kiro" });
const agent = source("agents/reviewer.json");
const missing = source("optional.md");

test("one snapshot keeps binary bytes after the source is replaced", async () => {
  const files = createInMemoryFileSystem({ files: {
    "file:///fixture/agents/reviewer.json": new Uint8Array([0, 255, 10]),
  } });
  const options = { root: new URL("file:///fixture/"), host: identity,
    sources: [agent], required: [agent], reader: files };
  const reader = createHostSurfaceReader(options);
  expect(await reader.read({ host: identity })).toEqual({ ok: true, value: [{
    source: agent, content: { kind: "bytes", bytes: new Uint8Array([0, 255, 10]) },
  }] });
  accept(await files.writeFile({ file: new URL("file:///fixture/agents/reviewer.json"),
    content: { kind: "bytes", bytes: new Uint8Array([9, 8]) } }));
  expect(await reader.read({ host: identity })).toEqual({ ok: true, value: [{
    source: agent, content: { kind: "bytes", bytes: new Uint8Array([0, 255, 10]) },
  }] });
  expect(await createHostSurfaceReader(options).read({ host: identity })).toEqual({ ok: true, value: [{
    source: agent, content: { kind: "bytes", bytes: new Uint8Array([9, 8]) },
  }] });
});

test("optional missing copy rows are omitted and required native sources refuse", async () => {
  const reader = createInMemoryFileSystem({ files: {} });
  expect(await createHostSurfaceReader({ root: new URL("file:///fixture/"), host: identity,
    sources: [missing], required: [], reader }).read({ host: identity })).toEqual({ ok: true, value: [] });
  expect(await createHostSurfaceReader({ root: new URL("file:///fixture/"), host: identity,
    sources: [agent], required: [agent], reader }).read({ host: identity })).toEqual({ ok: false,
    refusal: [{ kind: "host-source-unreadable", host: identity, source: agent,
      reason: "Host source is unreadable: not-found." }] });
});

test("selected source failures retain their actual source and declared order", async () => {
  const reader = createInMemoryFileSystem({ files: {}, faults: {
    "file:///fixture/agents/reviewer.json": "permission-denied",
    "file:///fixture/optional.md": "not-a-file",
  } });
  expect(await createHostSurfaceReader({ root: new URL("file:///fixture/"), host: identity,
    sources: [agent, missing], required: [], reader }).read({ host: identity })).toEqual({ ok: false,
    refusal: [
      { kind: "host-source-unreadable", host: identity, source: agent,
        reason: "Host source is unreadable: permission-denied." },
      { kind: "host-source-unreadable", host: identity, source: missing,
        reason: "Host source is unreadable: not-a-file." },
    ] });
});

test("the first capture deduplicates sources and repeated reads do no IO", async () => {
  const readFile = mock<HostFileReader["readFile"]>()
    .mockResolvedValueOnce(accepted({ kind: "bytes", bytes: new Uint8Array([1]) }))
    .mockResolvedValueOnce(accepted({ kind: "bytes", bytes: new Uint8Array([2]) }));
  const reader = createHostSurfaceReader({ root: new URL("file:///fixture/"), host: identity,
    sources: [missing, agent, missing], required: [], reader: { readFile } });
  expect(await reader.read({ host: identity })).toEqual({ ok: true, value: [
    { source: missing, content: { kind: "bytes", bytes: new Uint8Array([1]) } },
    { source: agent, content: { kind: "bytes", bytes: new Uint8Array([2]) } },
  ] });
  await reader.read({ host: identity });
  expect(readFile).toHaveBeenCalledTimes(2);
});

test("a cached failure is not retried after the underlying source becomes readable", async () => {
  const readFile = mock<HostFileReader["readFile"]>().mockResolvedValue(refused({
    kind: "unreadable", code: "permission-denied",
  }));
  const reader = createHostSurfaceReader({ root: new URL("file:///fixture/"), host: identity,
    sources: [agent], required: [agent], reader: { readFile } });
  expect(await reader.read({ host: identity })).toEqual({ ok: false, refusal: [{
    kind: "host-source-unreadable", host: identity, source: agent,
    reason: "Host source is unreadable: permission-denied.",
  }] });
  readFile.mockResolvedValue(accepted({ kind: "text", text: "now readable" }));
  expect(await reader.read({ host: identity })).toEqual({ ok: false, refusal: [{
    kind: "host-source-unreadable", host: identity, source: agent,
    reason: "Host source is unreadable: permission-denied.",
  }] });
  expect(readFile).toHaveBeenCalledTimes(1);
});

test("another host never reads this inventory", async () => {
  const readFile = mock<HostFileReader["readFile"]>();
  expect(await createHostSurfaceReader({ root: new URL("file:///fixture/"), host: identity,
    sources: [agent], required: [], reader: { readFile } }).read({
    host: host({ name: "claude", directory: ".claude" }),
  })).toEqual({ ok: false, refusal: [{ kind: "unknown-harness", harness: "claude" }] });
  expect(readFile).not.toHaveBeenCalled();
});

test("portable source punctuation is encoded as file data rather than URL structure", async () => {
  expect(await createHostSurfaceReader({ root: new URL("file:///fixture/"), host: identity,
    sources: [source("folder/a #.md")], required: [], reader: createInMemoryFileSystem({ files: {
      "file:///fixture/folder/a%20%23.md": "body",
    } }) }).read({ host: identity })).toEqual({ ok: true, value: [{
      source: source("folder/a #.md"), content: { kind: "bytes", bytes: new Uint8Array([98, 111, 100, 121]) },
    }] });
});
