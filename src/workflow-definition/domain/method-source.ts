import type { Brand } from "../../kernel/brand.ts";
import type { FileContent } from "../../kernel/file-content.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import { projectPath, sourcePath } from "../../kernel/values.ts";
import type { Owner } from "./identities.ts";

export type MethodSourcePath = Brand<string, "MethodSourcePath">;

export type MethodSourceRoot = Brand<string, "MethodSourceRoot">;

export type MethodSource = {
  readonly path: MethodSourcePath;
  readonly owner: Owner;
  readonly content: FileContent;
};

export type MethodSourceRefusal = {
  readonly kind: "invalid-method-source-location";
  readonly raw: string;
};

export const methodSourcePath = (raw: string): Result<MethodSourcePath, MethodSourceRefusal> =>
  sourcePath(raw).ok
    ? accepted(raw as MethodSourcePath)
    : refused({ kind: "invalid-method-source-location", raw });

export const methodSourceRoot = (raw: string): Result<MethodSourceRoot, MethodSourceRefusal> =>
  projectPath(raw).ok
    ? accepted(raw as MethodSourceRoot)
    : refused({ kind: "invalid-method-source-location", raw });
