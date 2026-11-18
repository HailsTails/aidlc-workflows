export type ChangeKind = "added" | "modified" | "deleted";

export type ChangedFile = {
  readonly path: string;
  readonly kind: ChangeKind;
};

export type BaseRevision = {
  readonly ref: string;
  readonly commit: string;
};

export const pathsOf = (changes: readonly ChangedFile[]): readonly string[] =>
  changes.map((change) => change.path);

export const presentPaths = (changes: readonly ChangedFile[]): readonly string[] =>
  changes.filter((change) => change.kind !== "deleted").map((change) => change.path);
