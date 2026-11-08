import type { FileContent } from "../../kernel/file-content.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import {
  methodSourcePath,
  type MethodSourceKind,
  type MethodSourcePath,
} from "../../workflow-definition/domain/method-source.ts";

export const text = (lines: readonly string[]): FileContent => ({
  kind: "text",
  text: `${lines.join("\n")}\n`,
});

export const methodPath = (kind: MethodSourceKind, within: string): MethodSourcePath =>
  accept(methodSourcePath({ kind, within }));
