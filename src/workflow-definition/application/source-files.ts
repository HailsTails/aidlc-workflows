import type { FileContent } from "../../kernel/file-content.ts";
import type { SourcePath } from "../../kernel/values.ts";

export type CapturedSourceFile = {
  readonly within: SourcePath;
  readonly content: FileContent;
};

export interface SourceFiles {
  read(directory: SourcePath): Promise<readonly CapturedSourceFile[]>;
}
