import type { Timestamp } from "../../kernel/values.ts";
import type { HookPoint, ToolKind } from "../../workflow-definition/domain/hooks.ts";
import type { AgentSlug } from "../../workflow-definition/domain/identities.ts";
import type { HumanEvidence } from "./gate.ts";
import type { GuardRefusal } from "./guard.ts";
import type { SessionId } from "./identities.ts";

export type ToolRequest = {
  readonly kind: ToolKind;
  readonly name: string;
  readonly target: string | null;
};

type At<Point extends HookPoint> = {
  readonly point: Point;
  readonly session: SessionId;
  readonly at: Timestamp;
};

export type HostEvent =
  | At<"session-start">
  | At<"session-end">
  | (At<"user-prompt"> & { readonly evidence: HumanEvidence })
  | (At<"before-tool"> & { readonly tool: ToolRequest })
  | (At<"after-tool"> & { readonly tool: ToolRequest; readonly succeeded: boolean })
  | (At<"subagent-start"> & { readonly agent: AgentSlug | null })
  | (At<"subagent-stop"> & { readonly agent: AgentSlug | null })
  | At<"stop">
  | At<"status-line">;

export type HostEventVerdict =
  | { readonly kind: "allow" }
  | { readonly kind: "add-context"; readonly text: string }
  | { readonly kind: "block"; readonly refusal: GuardRefusal };
