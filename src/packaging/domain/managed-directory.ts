import type { ProjectPath } from "../../kernel/values.ts";

export type DirectoryOwnership = "whole-directory" | "shipped-files-only";

export type ManagedDirectory = {
  readonly path: ProjectPath;
  readonly ownership: DirectoryOwnership;
};
