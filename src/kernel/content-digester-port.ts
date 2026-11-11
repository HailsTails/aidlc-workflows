import type { FileContent } from "./file-content.ts";
import type { Result } from "./result.ts";
import type { ContentHash, KernelRefusal } from "./values.ts";

export type ContentDigester = {
  hash(content: FileContent): Result<ContentHash, KernelRefusal>;
};
