import type { NonEmptyArray } from "../../kernel/values.ts";
import type { HookName } from "./identities.ts";
import type { MethodSourcePath } from "./method-source.ts";

export const TOOL_HOOK_POINTS = ["before-tool", "after-tool"] as const;

export const LIFECYCLE_HOOK_POINTS = [
  "session-start",
  "session-end",
  "user-prompt",
  "subagent-start",
  "subagent-stop",
  "before-compaction",
  "stop",
  "status-line",
] as const;

export const HOOK_POINTS = [...LIFECYCLE_HOOK_POINTS, ...TOOL_HOOK_POINTS] as const;

export type ToolHookPoint = (typeof TOOL_HOOK_POINTS)[number];

export type LifecycleHookPoint = (typeof LIFECYCLE_HOOK_POINTS)[number];

export type HookPoint = (typeof HOOK_POINTS)[number];

export const TOOL_TARGETS = [
  "file-read",
  "file-write",
  "file-search",
  "shell",
  "subagent-dispatch",
  "task-list-update",
  "human-question",
] as const;

export type ToolTarget = (typeof TOOL_TARGETS)[number];

export type ToolMatch =
  | { readonly kind: "every-tool" }
  | { readonly kind: "only"; readonly targets: NonEmptyArray<ToolTarget> };

export type LifecycleAttachment = { readonly point: LifecycleHookPoint };

export type ToolAttachment = { readonly point: ToolHookPoint; readonly tools: ToolMatch };

export type HookAttachment = LifecycleAttachment | ToolAttachment;

export type HookPlacement =
  | { readonly kind: "own-entry" }
  | { readonly kind: "in-group"; readonly group: HookName };

export type HookDeclaration = {
  readonly name: HookName;
  readonly source: MethodSourcePath;
  readonly placement: HookPlacement;
  readonly attachments: NonEmptyArray<HookAttachment>;
};
