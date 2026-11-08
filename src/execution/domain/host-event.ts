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

type Envelope<Point extends HookPoint> = {
  readonly point: Point;
  readonly session: SessionId;
  readonly at: Timestamp;
};

type HostEventShapes = {
  readonly "session-start": Envelope<"session-start">;
  readonly "session-end": Envelope<"session-end">;
  readonly "user-prompt": Envelope<"user-prompt"> & { readonly evidence: HumanEvidence };
  readonly "before-tool": Envelope<"before-tool"> & { readonly tool: ToolRequest };
  readonly "after-tool": Envelope<"after-tool"> & {
    readonly tool: ToolRequest;
    readonly succeeded: boolean;
  };
  readonly "subagent-start": Envelope<"subagent-start"> & { readonly agent: AgentSlug | null };
  readonly "subagent-stop": Envelope<"subagent-stop"> & { readonly agent: AgentSlug | null };
  readonly stop: Envelope<"stop">;
  readonly "status-line": Envelope<"status-line">;
};

export type HostEventAt<Point extends HookPoint> = HostEventShapes[Point];

export type HostEvent = HostEventShapes[HookPoint];

type Allow = { readonly kind: "allow" };

type AddContext = { readonly kind: "add-context"; readonly text: string };

type Block = { readonly kind: "block"; readonly refusal: GuardRefusal };

type ShowStatus = { readonly kind: "show-status"; readonly text: string };

type VerdictShapes = {
  readonly "session-start": Allow | AddContext;
  readonly "session-end": Allow;
  readonly "user-prompt": Allow | AddContext | Block;
  readonly "before-tool": Allow | AddContext | Block;
  readonly "after-tool": Allow | AddContext;
  readonly "subagent-start": Allow | AddContext;
  readonly "subagent-stop": Allow | Block;
  readonly stop: Allow | Block;
  readonly "status-line": ShowStatus;
};

export type VerdictFor<Point extends HookPoint> = VerdictShapes[Point];

export type ObservedHostEvent = {
  [Point in HookPoint]: {
    readonly event: HostEventAt<Point>;
    readonly verdict: VerdictFor<Point>;
  };
}[HookPoint];
