import type { FileContent, FileMode } from "../../kernel/file-content.ts";
import type { HostIdentity } from "../../kernel/host.ts";
import type {
  ContentHash,
  FrameworkVersion,
  ProjectPath,
  SourcePath,
} from "../../kernel/values.ts";
import type { ProjectionOrigin } from "../../projection/domain/projected-file.ts";
import type { ManagedDirectory } from "./managed-directory.ts";
import type { PriorIntegrationShapes, ReleaseHistory } from "./release-history.ts";
import type { RootIntegration } from "./root-integration.ts";

export const CHANNELS = ["copy", "native"] as const;

export type Channel = (typeof CHANNELS)[number];

export type RuntimeEntryPoint = {
  readonly name: string;
  readonly compositionRoot: SourcePath;
};

export type PayloadFileOrigin =
  | { readonly kind: "projected"; readonly origin: ProjectionOrigin }
  | { readonly kind: "bundled-runtime"; readonly entry: RuntimeEntryPoint }
  | { readonly kind: "version-stamp" }
  | { readonly kind: "distribution-descriptor" };

export type PayloadFile = {
  readonly path: ProjectPath;
  readonly hash: ContentHash;
  readonly content: FileContent;
  readonly mode: FileMode;
  readonly origin: PayloadFileOrigin;
};

export type DistributionLayout = {
  readonly rootIntegrations: readonly RootIntegration[];
  readonly managedDirectories: readonly ManagedDirectory[];
};

export type CliFirstSetup = {
  readonly env: readonly string[];
  readonly configNextStep: string;
  readonly firstRunSteps: readonly string[];
};

export type HostListing = {
  readonly choiceName?: string;
  readonly choiceNote?: string;
  readonly firstRunSteps?: readonly string[];
  readonly editorTerminalApp?: string;
  readonly cliFirst?: CliFirstSetup;
};

export type NativeReplacement = {
  readonly from: string;
  readonly to: string;
};

export type NativeRelease = {
  readonly replacements: readonly NativeReplacement[];
  readonly copyOnly: readonly ProjectPath[];
};

export type HostPluginTarget = {
  readonly format: string;
  readonly manifestDir: string;
  readonly marketplaceDir: string;
  readonly catalogue: "written" | "none";
  readonly installRoots: readonly string[];
};

export type HostDistribution = {
  readonly layout: DistributionLayout;
  readonly priorIntegrations: readonly PriorIntegrationShapes[];
  readonly listing: HostListing;
  readonly native: NativeRelease;
  readonly plugin: HostPluginTarget;
};

export type DistributionDescriptor = {
  readonly host: HostIdentity;
  readonly layout: DistributionLayout;
  readonly history: ReleaseHistory;
};

export type Payload = {
  readonly version: FrameworkVersion;
  readonly channel: Channel;
  readonly descriptor: DistributionDescriptor;
  readonly files: readonly PayloadFile[];
};
