import { z } from "zod";

const UNWALKABLE_SEGMENTS: readonly string[] = ["", ".", ".."];

const LEADING_DRIVE_LETTER = /^[A-Za-z]:/;

export const isRepoPathText = (request: { readonly text: string }): boolean =>
  !request.text.startsWith("/") &&
  !LEADING_DRIVE_LETTER.test(request.text) &&
  !request.text.includes("\\") &&
  request.text
    .split("/")
    .every((segment) => !UNWALKABLE_SEGMENTS.includes(segment));

export const repoPathSchema = z
  .string()
  .refine((text) => isRepoPathText({ text }))
  .brand<"RepoPath">();

export type RepoPath = z.infer<typeof repoPathSchema>;
