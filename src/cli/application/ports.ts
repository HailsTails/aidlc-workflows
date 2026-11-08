import type { HostEvent, ObservedHostEvent } from "../../execution/domain/host-event.ts";
import type { Result } from "../../kernel/result.ts";

export type DecodeRefusal = {
  readonly kind: "unrecognised-host-payload";
  readonly issues: readonly string[];
};

export interface HostEventDecoder {
  decode(raw: unknown): Result<HostEvent | null, DecodeRefusal>;
}

export type ExitStatus = 0 | 1 | 2;

export type HostResponse = {
  readonly output: string | null;
  readonly exitStatus: ExitStatus;
};

export interface HostResponseEncoder {
  encode(observed: ObservedHostEvent): HostResponse;
}

export interface CommandRoute {
  readonly verb: readonly string[];
  run(argv: readonly string[]): Promise<ExitStatus>;
}
