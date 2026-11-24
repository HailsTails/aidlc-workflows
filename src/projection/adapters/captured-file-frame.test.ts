import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { createInMemoryFileSystem } from "../../kernel/fixtures/file-system.fake.ts";
import { path } from "../../kernel/fixtures/values.fixture.ts";
import { createCapturedFileFrame } from "./captured-file-frame.ts";

const frames = new URL("file:///C:/q179-frames/");
const file = { path: path("aidlc/spaces/default/memory/org.md"),
  content: { kind: "bytes" as const, bytes: new Uint8Array([0xff, 0xfe]) },
  mode: "regular" as const, origin: { kind: "active-space" as const } };

test("captured bytes reach the frame unchanged, before the formatter runs, then are removed", async () => {
  const scratch = createInMemoryFileSystem({ files: {} });
  const render = mock(() => {
    expect(scratch.snapshot()).toEqual({ ["file:///C:/q179-frames/scratch-2/aidlc/spaces/default/memory/org.md"]: file.content });
    return accepted([]);
  });
  expect(await createCapturedFileFrame({ scratch, frames, nativePath: () => "/captured" }).render({ files: [file], render }))
    .toEqual(accepted([]));
  expect(render).toHaveBeenCalledTimes(1);
  expect(scratch.snapshot()).toEqual({});
});

test("a write failure refuses before formatting and still removes the private frame", async () => {
  const scratch = createInMemoryFileSystem({ files: {}, faults: {
    ["file:///C:/q179-frames/scratch-2/aidlc/spaces/default/memory/org.md"]: "permission-denied" } });
  const render = mock(() => accepted([]));
  expect(await createCapturedFileFrame({ scratch, frames, nativePath: () => "/captured" }).render({ files: [file], render }))
    .toEqual(refused({ kind: "render-failed", concept: "onboarding", name: "captured-file-frame",
      reason: "The captured file is unwritable: aidlc/spaces/default/memory/org.md: permission-denied" }));
  expect(render).not.toHaveBeenCalled();
  expect(scratch.snapshot()).toEqual({});
});

test("cleanup failure turns a successful render into a declared refusal", async () => {
  const scratch = createInMemoryFileSystem({ files: {} });
  const removeFolder = mock(async () => refused({ kind: "unwritable" as const, code: "permission-denied" as const }));
  expect(await createCapturedFileFrame({ scratch: { ...scratch, removeFolder }, frames, nativePath: () => "/captured" })
    .render({ files: [], render: () => accepted([]) })).toEqual(refused({ kind: "render-failed",
      concept: "onboarding", name: "captured-file-frame",
      reason: "The captured frame could not be removed: permission-denied" }));
  expect(removeFolder).toHaveBeenCalledTimes(1);
});

test("the first formatter refusal wins over a later cleanup refusal", async () => {
  const scratch = createInMemoryFileSystem({ files: {} });
  const removeFolder = mock(async () => refused({ kind: "unwritable" as const, code: "permission-denied" as const }));
  const refusal = { kind: "render-failed" as const, concept: "onboarding" as const, name: "frozen", reason: "first" };
  expect(await createCapturedFileFrame({ scratch: { ...scratch, removeFolder }, frames, nativePath: () => "/captured" })
    .render({ files: [], render: () => refused(refusal) })).toEqual(refused(refusal));
  expect(removeFolder).toHaveBeenCalledTimes(1);
});

test("a thrown cleanup failure cannot replace the causal formatter refusal", async () => {
  const scratch = createInMemoryFileSystem({ files: {} });
  const cleanup = new Error("cleanup threw");
  const failure = refused({ kind: "render-failed" as const, concept: "onboarding" as const,
    name: "frozen", reason: "causal refusal" });
  const removeFolder = mock(async () => { throw cleanup; });
  expect(await createCapturedFileFrame({ scratch: { ...scratch, removeFolder }, frames, nativePath: () => "/captured" })
    .render({ files: [], render: () => failure })).toBe(failure);
  expect(removeFolder).toHaveBeenCalledTimes(1);
});

test("a thrown cleanup failure refuses an otherwise successful render", async () => {
  const scratch = createInMemoryFileSystem({ files: {} });
  const removeFolder = mock(async () => { throw new Error("cleanup threw"); });
  expect(await createCapturedFileFrame({ scratch: { ...scratch, removeFolder }, frames, nativePath: () => "/captured" })
    .render({ files: [], render: () => accepted([]) })).toEqual(refused({
      kind: "render-failed", concept: "onboarding", name: "captured-file-frame",
      reason: "The captured frame could not be removed: cleanup threw",
    }));
});
