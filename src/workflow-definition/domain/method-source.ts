import { brand, type Brand } from "../../kernel/brand.ts";
import type { FileContent } from "../../kernel/file-content.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import { projectPath, sourcePath } from "../../kernel/values.ts";
import type { Owner } from "./identities.ts";

export const METHOD_SOURCE_FOLDERS = {
  stage: "aidlc-common/stages",
  agent: "aidlc-common/agents",
  scope: "scopes",
  sensor: "sensors",
  knowledge: "knowledge",
  rule: "memory",
  hook: "hooks",
  overlay: "contributions",
} as const;

export type MethodSourceKind = keyof typeof METHOD_SOURCE_FOLDERS;

export type MethodSourcePath = Brand<string, "MethodSourcePath">;

export type MethodSourceRoot = Brand<string, "MethodSourceRoot">;

export type MethodSourceLocation = {
  readonly owner: Owner;
  readonly path: MethodSourcePath;
};

export type MethodSource = MethodSourceLocation & {
  readonly content: FileContent;
};

export type MethodSourceRefusal = {
  readonly kind: "invalid-method-source-location";
  readonly raw: string;
};

export const methodSourcePath = (request: {
  readonly kind: MethodSourceKind;
  readonly within: string;
}): Result<MethodSourcePath, MethodSourceRefusal> => {
  const raw = `${METHOD_SOURCE_FOLDERS[request.kind]}/${request.within}`;
  return sourcePath(raw).ok
    ? accepted(brand<MethodSourcePath>(raw))
    : refused({ kind: "invalid-method-source-location", raw });
};

export const methodSourceRoot = (raw: string): Result<MethodSourceRoot, MethodSourceRefusal> =>
  projectPath(raw).ok
    ? accepted(brand<MethodSourceRoot>(raw))
    : refused({ kind: "invalid-method-source-location", raw });
