import type { ContentHash, RelativePath } from "../../kernel/values.ts";

export type ExpectedState =
  | { readonly kind: "absent" }
  | { readonly kind: "hash"; readonly hash: ContentHash };

export type FileOperation =
  | {
      readonly kind: "write";
      readonly path: RelativePath;
      readonly bytes: Uint8Array;
      readonly hash: ContentHash;
      readonly executable: boolean;
      readonly expected: ExpectedState;
    }
  | { readonly kind: "remove"; readonly path: RelativePath; readonly expected: ExpectedState }
  | {
      readonly kind: "link";
      readonly path: RelativePath;
      readonly target: string;
      readonly expected: ExpectedState;
    };
