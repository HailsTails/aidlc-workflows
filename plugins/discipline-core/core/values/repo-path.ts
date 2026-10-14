import { z } from "zod";

export type RepoPathVerdict = "repo-path" | "not-repo-path";

const UNWALKABLE_SEGMENTS: readonly string[] = ["", ".", ".."];

const LEADING_DRIVE_LETTER = /^[A-Za-z]:/;

const LINE_BREAK_OR_NUL = /[\n\r\0]/;

export const isRepoPathText = (request: { readonly text: string }): RepoPathVerdict =>
  !request.text.startsWith("/") &&
  !LEADING_DRIVE_LETTER.test(request.text) &&
  !request.text.includes("\\") &&
  !LINE_BREAK_OR_NUL.test(request.text) &&
  request.text.split("/").every((segment) => !UNWALKABLE_SEGMENTS.includes(segment))
    ? "repo-path"
    : "not-repo-path";

export const repoPathSchema = z
  .string()
  .superRefine((text, context) => {
    if (isRepoPathText({ text }) === "not-repo-path") {
      context.addIssue({ code: "custom", message: "not a repo-relative path" });
    }
  })
  .brand<"RepoPath">();

export type RepoPath = z.infer<typeof repoPathSchema>;
