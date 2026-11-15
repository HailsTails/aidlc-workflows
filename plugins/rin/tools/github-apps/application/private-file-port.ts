import type { Result } from "../domain/result.ts";

type PrivateFileWrite = { readonly location: string; readonly text: string };

type FileUnwritable = {
  readonly kind: "file-unwritable";
  readonly location: string;
  readonly detail: string;
};

type FileAlreadyExists = { readonly kind: "file-already-exists"; readonly location: string };

type PrivateFileReplacer = (write: PrivateFileWrite) => Promise<Result<void, FileUnwritable>>;

type PrivateFileCreator = (
  write: PrivateFileWrite,
) => Promise<Result<void, FileUnwritable | FileAlreadyExists>>;

type FileRemover = (location: string) => Promise<Result<void, FileUnwritable>>;

export type {
  FileAlreadyExists,
  FileRemover,
  FileUnwritable,
  PrivateFileCreator,
  PrivateFileReplacer,
  PrivateFileWrite,
};
