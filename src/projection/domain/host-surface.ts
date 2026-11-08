import type { FileContent } from "../../kernel/file-content.ts";
import type { SourcePath } from "../../kernel/values.ts";

export type AuthoredHostFile = {
  readonly source: SourcePath;
  readonly content: FileContent;
};
