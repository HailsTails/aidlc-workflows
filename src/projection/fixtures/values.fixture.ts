import type { FileContent } from "../../kernel/file-content.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import {
  methodSourcePath,
  methodSourceRoot,
  type MethodSourcePath,
  type MethodSourceRoot,
} from "../../workflow-definition/domain/method-source.ts";

export const text = (lines: readonly string[]): FileContent => ({
  kind: "text",
  text: `${lines.join("\n")}\n`,
});

export const methodPath = (raw: string): MethodSourcePath => accept(methodSourcePath(raw));

export const root = (raw: string): MethodSourceRoot => accept(methodSourceRoot(raw));
