import type { Result } from "../domain/result.ts";

type FileUnreadable = { readonly kind: "file-unreadable"; readonly location: string };

type TextFileReader = (location: string | URL) => Promise<Result<string, FileUnreadable>>;

type CanonicalPathResolver = (location: string) => Promise<Result<string, FileUnreadable>>;

export type { CanonicalPathResolver, FileUnreadable, TextFileReader };
