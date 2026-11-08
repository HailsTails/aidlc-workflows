import type {
  HostConversationSource,
  HumanTurnHistory,
} from "../execution/application/boundary-ports.ts";
import type { HostShell } from "../installation/application/boundary-ports.ts";
import type { HostIdentity } from "../kernel/host.ts";
import type { DistributionLayout } from "../packaging/domain/payload.ts";
import type { Harness } from "../projection/application/ports.ts";
import type {
  CommandRoute,
  HostEventDecoder,
  HostResponseEncoder,
} from "./application/ports.ts";

export type BuildHost = {
  readonly host: HostIdentity;
  readonly harness: Harness;
  readonly layout: DistributionLayout;
};

export type RuntimeHost = {
  readonly host: HostIdentity;
  readonly shell: HostShell;
  readonly conversation: HostConversationSource;
  readonly humanTurns: HumanTurnHistory;
  readonly decoder: HostEventDecoder;
  readonly encoder: HostResponseEncoder;
};

export interface BuildRoot {
  routes(request: { readonly hosts: readonly BuildHost[] }): readonly CommandRoute[];
}

export interface RuntimeRoot {
  routes(request: {
    readonly hosts: readonly RuntimeHost[];
    readonly calling: RuntimeHost | null;
  }): readonly CommandRoute[];
}
