import { sourcePath } from "../../kernel/values.ts";
import type { CapturedSourceFile, SourceFiles } from "../application/source-files.ts";
import { authoredValue } from "./authored-markdown.ts";

export const capturedSourceFiles = (files: readonly CapturedSourceFile[]): SourceFiles => ({
  read: async (directory) => files.filter((file) =>
    file.within.startsWith(`${directory}/`) && file.within.endsWith(".md"))
    .map((file) => ({ content: file.content,
      within: authoredValue(sourcePath(file.within.slice(directory.length + 1))) })),
});
