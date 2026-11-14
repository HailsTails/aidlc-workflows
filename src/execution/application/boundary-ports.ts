import type { Result } from "../../kernel/result.ts";
import type { Timestamp } from "../../kernel/values.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import type { HumanEvidence } from "../domain/gate.ts";
import type { HostEvent, ObservedHostEvent } from "../domain/host-event.ts";
import type { SessionId } from "../domain/identities.ts";
import type { ExecutionRefusal } from "../domain/refusals.ts";

export interface HumanTurnHistory {
  humanTurnsSince(request: {
    readonly session: SessionId;
    readonly from: Timestamp;
  }): Promise<readonly HumanEvidence[]>;
}

export interface MethodProvider {
  current(): Promise<Result<Method, ExecutionRefusal>>;
}

export type HostConversation = {
  readonly missedReply: string | null;
  readonly agentStep: string | null;
  readonly newChatStep: string | null;
  readonly directiveMaxBytes: number;
  readonly questionOptions: number;
};

export interface HostConversationSource {
  conversation(): HostConversation;
}

export type DecodeRefusal = {
  readonly kind: "unrecognised-host-payload";
  readonly issues: readonly string[];
};

export interface HostEventDecoder {
  decode(raw: unknown): Result<HostEvent | null, DecodeRefusal>;
}

export type HostExitStatus = 0 | 1 | 2;

export type HostResponse = {
  readonly output: string | null;
  readonly exitStatus: HostExitStatus;
};

export interface HostResponseEncoder {
  encode(observed: ObservedHostEvent): HostResponse;
}
