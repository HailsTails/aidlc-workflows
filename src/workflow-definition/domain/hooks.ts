import type { NonEmptyArray } from "../../kernel/values.ts";
import type { HookName, Owner } from "./identities.ts";
import type { MethodSourcePath } from "./method-source.ts";

export const TOOL_HOOK_POINTS = ["before-tool", "after-tool"] as const;

export const LIFECYCLE_HOOK_POINTS = [
  "session-start",
  "session-end",
  "user-prompt",
  "subagent-start",
  "subagent-stop",
  "stop",
  "status-line",
] as const;

export const HOOK_POINTS = [...LIFECYCLE_HOOK_POINTS, ...TOOL_HOOK_POINTS] as const;

export type ToolHookPoint = (typeof TOOL_HOOK_POINTS)[number];

export type LifecycleHookPoint = (typeof LIFECYCLE_HOOK_POINTS)[number];

export type HookPoint = (typeof HOOK_POINTS)[number];

export const TOOL_KINDS = ["shell", "file-write", "file-read", "other"] as const;

export type ToolKind = (typeof TOOL_KINDS)[number];

export type ToolMatch =
  | { readonly kind: "every-tool" }
  | { readonly kind: "only"; readonly tools: NonEmptyArray<ToolKind> };

type HookBase = {
  readonly name: HookName;
  readonly owner: Owner;
  readonly source: MethodSourcePath;
};

export type LifecycleHook = HookBase & { readonly point: LifecycleHookPoint };

export type ToolHook = HookBase & { readonly point: ToolHookPoint; readonly tools: ToolMatch };

export type HookDeclaration = LifecycleHook | ToolHook;
