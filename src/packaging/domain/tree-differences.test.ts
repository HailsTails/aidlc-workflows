import { expect, test } from "bun:test";
import type { FileContent } from "../../kernel/file-content.ts";
import type { TreeFile } from "../../kernel/file-system-port.ts";
import { source } from "../../kernel/fixtures/values.fixture.ts";
import { treeDifferences } from "./tree-differences.ts";

const file = (path: string, content: FileContent): TreeFile => ({ path: source(path), content });
const text = (path: string, content: string): TreeFile => file(path, { kind: "text", text: content });

test("diagnostics retain both legacy passes with code-unit sorted POSIX paths", () => {
  expect(treeDifferences({
    first: [text("z/item.bin", "old"), text("z.txt", "old"), text("a.txt", "missing"), text("Z.txt", "old")],
    second: [text("z/item.bin", "new"), text("b-only.txt", "new"), text("z.txt", "new"),
      text("A-only.txt", "new"), text("Z.txt", "new")],
    prefix: "dist",
  })).toEqual([
    "DIFFERS between builds: dist/Z.txt",
    "MISSING in second build: dist/a.txt",
    "DIFFERS between builds: dist/z.txt",
    "DIFFERS between builds: dist/z/item.bin",
    "ONLY in second build: dist/A-only.txt",
    "ONLY in second build: dist/b-only.txt",
  ]);
});

test("equal text and its exact UTF-8 bytes agree, including empty content", () => {
  expect(treeDifferences({ first: [text("word.txt", "café"), text("empty", "")],
    second: [file("word.txt", { kind: "bytes", bytes: new Uint8Array([99, 97, 102, 195, 169]) }),
      file("empty", { kind: "bytes", bytes: new Uint8Array() })], prefix: "dist-release" })).toEqual([]);
});

test("binary byte differences are not collapsed through UTF-8 decoding", () => {
  expect(treeDifferences({ first: [file("data.bin", { kind: "bytes", bytes: new Uint8Array([255, 0]) })],
    second: [file("data.bin", { kind: "bytes", bytes: new Uint8Array([254, 0]) })],
    prefix: "dist-release" })).toEqual(["DIFFERS between builds: dist-release/data.bin"]);
});

test("content length and line ending changes differ even with a matching prefix", () => {
  expect(treeDifferences({ first: [text("short", "a"), text("line", "a\n")],
    second: [text("short", "ab"), text("line", "a\r\n")], prefix: "dist" })).toEqual([
    "DIFFERS between builds: dist/line", "DIFFERS between builds: dist/short",
  ]);
});

test("binary views compare only their selected bytes", () => {
  expect(treeDifferences({ first: [file("data", { kind: "bytes", bytes: new Uint8Array([0, 7, 8, 0]).subarray(1, 3) })],
    second: [file("data", { kind: "bytes", bytes: new Uint8Array([7, 8]) })], prefix: "dist" })).toEqual([]);
});

test("an empty first tree reports only second files in code-unit order", () => {
  expect(treeDifferences({ first: [], second: [text("z/nested", ""), text("A.txt", "")],
    prefix: "dist-release" })).toEqual([
    "ONLY in second build: dist-release/A.txt", "ONLY in second build: dist-release/z/nested",
  ]);
});

test("an empty second tree reports every first file and empty trees agree", () => {
  expect(treeDifferences({ first: [text("z/nested", ""), text("A.txt", "")], second: [], prefix: "dist" }))
    .toEqual(["MISSING in second build: dist/A.txt", "MISSING in second build: dist/z/nested"]);
  expect(treeDifferences({ first: [], second: [], prefix: "dist" })).toEqual([]);
});

test("comparison accepts frozen inventories without reordering their inputs", () => {
  const z = text("z", "same");
  const a = text("a", "same");
  const first = Object.freeze([z, a]);
  const second = Object.freeze([a, z]);
  expect(treeDifferences({ first, second, prefix: "dist" })).toEqual([]);
  expect(first).toEqual([z, a]);
  expect(second).toEqual([a, z]);
});
