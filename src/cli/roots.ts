import type {
  HostConversationSource,
  HostEventDecoder,
  HostResponseEncoder,
  HumanTurnHistory,
} from "../execution/application/boundary-ports.ts";
import type { HostShell } from "../installation/application/boundary-ports.ts";
import type { FileSystem } from "../kernel/file-system-port.ts";
import type { HostIdentity } from "../kernel/host.ts";
import type { ProcessRunner } from "../kernel/process-runner-port.ts";
import type { SourcePath } from "../kernel/values.ts";
import type { YamlParser } from "../kernel/yaml-parser-port.ts";
import type { DistributionLayout } from "../packaging/domain/payload.ts";
import type {
  CommandPlacement,
  Harness,
  HostDocumentRenderer,
  HostSettingsRenderer,
  HostSkillRenderer,
} from "../projection/application/ports.ts";
import type { AuthoredPlacement, HostData } from "../projection/domain/host-surface.ts";
import type { HostTokenBindings } from "../projection/domain/template-token.ts";
import type { MarkdownOutliner } from "../workflow-definition/application/ports.ts";

export type ExitStatus = 0 | 1 | 2;

export interface CommandRoute {
  readonly verb: readonly string[];
  run(argv: readonly string[]): Promise<ExitStatus>;
}

export type BuildHost = {
  readonly host: HostIdentity;
  readonly harness: Harness;
  readonly layout: DistributionLayout;
};

export type ConceptMembers<Render> = {
  readonly inputs: readonly SourcePath[];
  readonly render: Render;
};

export type HostConceptMembers<Render> = ConceptMembers<Render> & {
  readonly host: HostIdentity;
};

export type HostSkillMembers = HostConceptMembers<HostSkillRenderer>;

export type HostSettingsMembers = HostConceptMembers<HostSettingsRenderer>;

export type HostDocumentMembers = HostConceptMembers<HostDocumentRenderer>;

export type HostBuildMembers = {
  readonly host: HostIdentity;
  readonly tokens: HostTokenBindings;
  readonly data: HostData;
  readonly placements: readonly AuthoredPlacement[];
  readonly agents: Harness["renderAgent"];
  readonly commands: CommandPlacement;
  readonly skills: ConceptMembers<HostSkillRenderer>;
  readonly settings: ConceptMembers<HostSettingsRenderer>;
  readonly documents: ConceptMembers<HostDocumentRenderer>;
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

export type Platform = {
  readonly fileSystem: FileSystem;
  readonly processRunner: ProcessRunner;
  readonly yaml: YamlParser;
};

export type BuildSources = {
  readonly core: URL;
  readonly plugins: URL;
};

export type CreateBuildRoot = (createBuildRootArgs: {
  readonly platform: Platform;
  readonly outliner: MarkdownOutliner;
  readonly sources: BuildSources;
}) => BuildRoot;

export interface RuntimeRoot {
  routes(request: {
    readonly hosts: readonly RuntimeHost[];
    readonly calling: RuntimeHost | null;
  }): readonly CommandRoute[];
}
