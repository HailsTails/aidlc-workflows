import type { FileContent, FileMode } from "../../kernel/file-content.ts";
import type { ContentHash, ProjectPath } from "../../kernel/values.ts";

export type ExpectedState =
  | { readonly kind: "absent" }
  | { readonly kind: "hash"; readonly hash: ContentHash };

export type PlannedContent = {
  readonly content: FileContent;
  readonly hash: ContentHash;
};

export type FileOperation =
  | {
      readonly kind: "write";
      readonly path: ProjectPath;
      readonly next: PlannedContent;
      readonly mode: FileMode;
      readonly expected: ExpectedState;
    }
  | { readonly kind: "remove"; readonly path: ProjectPath; readonly expected: ExpectedState }
  | {
      readonly kind: "link";
      readonly path: ProjectPath;
      readonly target: string;
      readonly expected: ExpectedState;
    };
