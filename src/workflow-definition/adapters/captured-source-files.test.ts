import { expect, test } from "bun:test";
import type { FileContent } from "../../kernel/file-content.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import { sourcePath } from "../../kernel/values.ts";
import { capturedSourceFiles } from "./captured-source-files.ts";

test("a capture reads only Markdown descendants and preserves exact bytes", async () => {
  const bytes = { kind: "bytes" as const, bytes: new Uint8Array([0, 255, 10]) };
  const files = capturedSourceFiles([
    { within: accept(sourcePath("agents/nested/reviewer.md")), content: bytes },
    { within: accept(sourcePath("agents/note.txt")), content: { kind: "text", text: "excluded" } },
    { within: accept(sourcePath("agents-extra/other.md")), content: { kind: "text", text: "excluded" } },
  ]);
  expect(await files.read(accept(sourcePath("agents")))).toEqual<readonly { within: string; content: FileContent }[]>([
    { within: "nested/reviewer.md", content: { kind: "bytes", bytes: new Uint8Array([0, 255, 10]) } },
  ]);
  expect(await files.read(accept(sourcePath("missing")))).toEqual([]);
});
