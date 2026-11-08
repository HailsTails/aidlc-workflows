import type {
  ContentHash,
  DistributionId,
  FrameworkVersion,
  RelativePath,
} from "../../kernel/values.ts";
import type { HarnessProfile } from "../../projection/domain/harness-profile.ts";
import type { FileContent, ProjectionOrigin } from "../../projection/domain/projected-file.ts";
import type { RootIntegration } from "../../projection/domain/root-integration.ts";

export const LAYOUTS = ["copy", "native"] as const;

export type Layout = (typeof LAYOUTS)[number];

export type RuntimeEntryPoint = {
  readonly name: string;
  readonly compositionRoot: RelativePath;
};

export type PayloadFileOrigin =
  | { readonly kind: "projected"; readonly origin: ProjectionOrigin }
  | { readonly kind: "bundled-runtime"; readonly entry: RuntimeEntryPoint }
  | { readonly kind: "version-stamp" }
  | { readonly kind: "distribution-descriptor" };

export type PayloadFile = {
  readonly path: RelativePath;
  readonly hash: ContentHash;
  readonly content: FileContent;
  readonly executable: boolean;
  readonly origin: PayloadFileOrigin;
};

export type VersionStamp = {
  readonly frameworkVersion: FrameworkVersion;
  readonly distribution: DistributionId;
  readonly harnessDirectory: RelativePath;
};

export type RetiredFile = {
  readonly path: RelativePath;
  readonly shippedHashes: readonly ContentHash[];
};

export type DistributionDescriptor = {
  readonly profile: HarnessProfile;
  readonly rootIntegrations: readonly RootIntegration[];
  readonly managedDirectories: readonly RelativePath[];
  readonly retiredFiles: readonly RetiredFile[];
};

export type Payload = {
  readonly distribution: DistributionId;
  readonly layout: Layout;
  readonly stamp: VersionStamp;
  readonly descriptor: DistributionDescriptor;
  readonly files: readonly PayloadFile[];
};
