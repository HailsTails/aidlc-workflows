import type { SourcePath } from "../../kernel/values.ts";
import type { HookName, Owner } from "./identities.ts";

export const HOOK_POINTS = [
  "session-start",
  "session-end",
  "user-prompt",
  "before-tool",
  "after-tool",
  "subagent-start",
  "subagent-stop",
  "stop",
  "status-line",
] as const;

export type HookPoint = (typeof HOOK_POINTS)[number];

export const TOOL_KINDS = ["shell", "file-write", "file-read", "other"] as const;

export type ToolKind = (typeof TOOL_KINDS)[number];

export type ToolMatch =
  | { readonly kind: "every-tool" }
  | { readonly kind: "only"; readonly tools: readonly ToolKind[] };

export type HookDeclaration = {
  readonly name: HookName;
  readonly owner: Owner;
  readonly point: HookPoint;
  readonly tools: ToolMatch;
  readonly entry: SourcePath;
};
