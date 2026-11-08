import { expect, mock, test } from "bun:test";
import { host, source } from "../../kernel/fixtures/values.fixture.ts";
import { createHostSurfaceReader } from "./host-source-files.ts";

const identity = host({ name: "kiro", directory: ".kiro" });
const agent = source("agents/reviewer.json");
const missing = source("optional.md");

test("one snapshot preserves binary bytes after the underlying source changes", async () => {
  const read = mock<(path: string) => Promise<Uint8Array>>()
    .mockResolvedValue(new Uint8Array([0, 255, 10]));
  const options = { root: "fixture", host: identity, sources: [agent], required: [agent], read };
  const reader = createHostSurfaceReader(options);
  expect(await reader.read({ host: identity })).toEqual({ ok: true, value: [{
    source: agent, content: { kind: "bytes", bytes: new Uint8Array([0, 255, 10]) },
  }] });
  read.mockResolvedValue(new Uint8Array([9, 8]));
  expect(await reader.read({ host: identity })).toEqual({ ok: true, value: [{
    source: agent, content: { kind: "bytes", bytes: new Uint8Array([0, 255, 10]) },
  }] });
  expect(read).toHaveBeenCalledTimes(1);
  expect(await createHostSurfaceReader(options).read({ host: identity })).toEqual({
    ok: true, value: [{ source: agent, content: { kind: "bytes", bytes: new Uint8Array([9, 8]) } }],
  });
});

test("optional absent copy rows are omitted but required missing native sources refuse", async () => {
  const error = Object.assign(new Error("Missing authored source"), { code: "ENOENT" });
  const read = mock<(path: string) => Promise<Uint8Array>>().mockRejectedValue(error);
  expect(await createHostSurfaceReader({ root: "fixture", host: identity,
    sources: [missing], required: [], read }).read({ host: identity }))
    .toEqual({ ok: true, value: [] });
  expect(await createHostSurfaceReader({ root: "fixture", host: identity,
    sources: [agent], required: [agent], read }).read({ host: identity }))
    .toEqual({ ok: false, refusal: [{ kind: "host-source-unreadable",
      host: identity, source: agent, reason: "Missing authored source" }] });
});

test("other source failures retain the actual host and portable source", async () => {
  const read = mock<(path: string) => Promise<Uint8Array>>()
    .mockRejectedValue(new Error("Access denied"));
  expect(await createHostSurfaceReader({ root: "fixture", host: identity,
    sources: [agent], required: [], read }).read({ host: identity }))
    .toEqual({ ok: false, refusal: [{ kind: "host-source-unreadable",
      host: identity, source: agent, reason: "Access denied" }] });
});

test("the first capture deduplicates paths and retains declared order", async () => {
  const read = mock<(path: string) => Promise<Uint8Array>>()
    .mockResolvedValueOnce(new Uint8Array([1])).mockResolvedValueOnce(new Uint8Array([2]));
  expect(await createHostSurfaceReader({ root: "fixture", host: identity,
    sources: [missing, agent, missing], required: [], read }).read({ host: identity }))
    .toEqual({ ok: true, value: [
      { source: missing, content: { kind: "bytes", bytes: new Uint8Array([1]) } },
      { source: agent, content: { kind: "bytes", bytes: new Uint8Array([2]) } },
    ] });
  expect(read).toHaveBeenCalledTimes(2);
});

test("a reader does not read its root for another host", async () => {
  const read = mock<(path: string) => Promise<Uint8Array>>();
  expect(await createHostSurfaceReader({ root: "fixture", host: identity,
    sources: [agent], required: [], read }).read({
    host: host({ name: "claude", directory: ".claude" }),
  })).toEqual({ ok: false, refusal: [{ kind: "unknown-harness", harness: "claude" }] });
  expect(read).not.toHaveBeenCalled();
});
