import type { RelativePath } from "../../kernel/values.ts";

export type DirectoryOwnership = "whole-directory" | "shipped-files-only";

export type ManagedDirectory = {
  readonly path: RelativePath;
  readonly ownership: DirectoryOwnership;
};
