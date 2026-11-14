import { refused } from "../../kernel/result.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import { expect, mock, test } from "bun:test";
import type { FileContent } from "../../kernel/file-content.ts";
import { host, source } from "../../kernel/fixtures/values.fixture.ts";
import { prepareHostSource } from "./prepared-host-source.ts";

const identity = host({ name: "kiro", directory: ".kiro" });
const file = { source: source("agents/reviewer.json"),
  content: { kind: "text" as const, text: "raw" } };

test("preparation preserves the single chain order and leaves the raw value intact", () => {
  const tokens = mock<(content: FileContent) => FileContent>()
    .mockReturnValue({ kind: "text", text: "tokens" });
  const model = mock<(content: FileContent) => FileContent>()
    .mockReturnValue({ kind: "text", text: "model" });
  const knowledge = mock<(content: FileContent) => FileContent>()
    .mockReturnValue({ kind: "text", text: "knowledge" });
  const hooks = mock<(content: FileContent) => FileContent>()
    .mockReturnValue({ kind: "text", text: "hooks" });
  expect(prepareHostSource({ host: identity, file, steps: [tokens, model, knowledge, hooks] }))
    .toEqual({ ok: true, value: { source: file.source, content: { kind: "text", text: "hooks" } } });
  expect(tokens).toHaveBeenCalledWith({ kind: "text", text: "raw" });
  expect(model).toHaveBeenCalledWith({ kind: "text", text: "tokens" });
  expect(knowledge).toHaveBeenCalledWith({ kind: "text", text: "model" });
  expect(hooks).toHaveBeenCalledWith({ kind: "text", text: "knowledge" });
  expect(file.content).toEqual({ kind: "text", text: "raw" });
});

test("binary prepared values do not share the raw byte view", () => {
  const bytes = new Uint8Array([0, 255]);
  const rawFile = { source: file.source, content: { kind: "bytes" as const, bytes } };
  const prepared = prepareHostSource({ host: identity, file: rawFile, steps: [] });
  rawFile.content.bytes[0] = 9;
  expect(prepared).toEqual({ ok: true, value: {
    source: file.source, content: { kind: "bytes", bytes: new Uint8Array([0, 255]) },
  } });
  expect(accept(prepared).content).not.toBe(rawFile.content);
  expect(rawFile.content.bytes).toEqual(new Uint8Array([9, 255]));
});

test("a failed preparation reports its source and does not run later steps", () => {
  const broken = mock<(content: FileContent) => FileContent>()
    .mockImplementationOnce(() => accept<FileContent, string>(refused("preparation failed")));
  const later = mock<(content: FileContent) => FileContent>();
  const prepared = prepareHostSource({ host: identity, file, steps: [broken, later] });
  expect(prepared).toMatchObject({ ok: false, refusal: {
    kind: "host-source-unreadable", host: identity, source: file.source,
    reason: 'Fixture value refused: "preparation failed"',
  } });
  expect(later).not.toHaveBeenCalled();
  expect(file.content).toEqual({ kind: "text", text: "raw" });
});
