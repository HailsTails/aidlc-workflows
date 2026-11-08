import type { Timestamp } from "../../kernel/values.ts";
import type { AgentSlug } from "../../workflow-definition/domain/identities.ts";
import type { HumanEvidence } from "./gate.ts";
import type { SessionId } from "./identities.ts";

export type HostEvent =
  | { readonly kind: "session-started"; readonly session: SessionId; readonly at: Timestamp }
  | { readonly kind: "session-ended"; readonly session: SessionId; readonly at: Timestamp }
  | { readonly kind: "human-turn"; readonly evidence: HumanEvidence }
  | {
      readonly kind: "tool-requested";
      readonly session: SessionId;
      readonly tool: string;
      readonly target: string | null;
      readonly at: Timestamp;
    }
  | {
      readonly kind: "subagent-finished";
      readonly session: SessionId;
      readonly agent: AgentSlug | null;
      readonly at: Timestamp;
    }
  | { readonly kind: "turn-ended"; readonly session: SessionId; readonly at: Timestamp };

export type HostEventVerdict =
  | { readonly kind: "allow" }
  | { readonly kind: "block"; readonly reason: string; readonly nextStep: string };
