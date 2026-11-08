import type { FileContent } from "../../kernel/file-content.ts";
import type {
  ContentHash,
  DistributionId,
  FrameworkVersion,
  ProjectPath,
  SourcePath,
} from "../../kernel/values.ts";
import type { ProjectionOrigin } from "../../projection/domain/projected-file.ts";
import type { ManagedDirectory } from "./managed-directory.ts";
import type { ReleaseHistory } from "./release-history.ts";
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
  readonly executable: boolean;
  readonly origin: PayloadFileOrigin;
};

export type DistributionLayout = {
  readonly distribution: DistributionId;
  readonly harnessDirectory: ProjectPath;
  readonly rootIntegrations: readonly RootIntegration[];
  readonly managedDirectories: readonly ManagedDirectory[];
};

export type DistributionDescriptor = {
  readonly layout: DistributionLayout;
  readonly history: ReleaseHistory;
};

export type Payload = {
  readonly version: FrameworkVersion;
  readonly channel: Channel;
  readonly descriptor: DistributionDescriptor;
  readonly files: readonly PayloadFile[];
};
