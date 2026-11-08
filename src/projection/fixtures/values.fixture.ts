import type { FileContent } from "../domain/projected-file.ts";

export const text = (lines: readonly string[]): FileContent => ({
  kind: "text",
  text: `${lines.join("\n")}\n`,
});
