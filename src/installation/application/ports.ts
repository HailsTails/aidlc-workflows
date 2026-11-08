import type { Result } from "../../kernel/result.ts";
import type { ContentHash, DistributionId, ProjectPath } from "../../kernel/values.ts";
import type { Payload } from "../../packaging/domain/payload.ts";
import type { RootIntegration } from "../../packaging/domain/root-integration.ts";
import type { ExpectedState, FileOperation } from "../domain/file-operation.ts";
import type { InstalledDistribution } from "../domain/installed-distribution.ts";
import type { OwnershipRecord } from "../domain/ownership.ts";
import type { InstallRefusal } from "../domain/refusals.ts";
import type { SiblingBlock } from "../domain/sibling-block.ts";

export type ProjectFileState =
  | { readonly kind: "absent" }
  | {
      readonly kind: "file";
      readonly hash: ContentHash;
      readonly text: string | null;
      readonly executable: boolean | null;
    }
  | { readonly kind: "link" }
  | { readonly kind: "directory" };

export interface ProjectFiles {
  read(path: ProjectPath): Promise<ProjectFileState>;
}

export interface OwnershipStore {
  read(harnessDirectory: ProjectPath): Promise<Result<OwnershipRecord | null, InstallRefusal>>;
}

export type RecordWrite = {
  readonly harnessDirectory: ProjectPath;
  readonly expected: ExpectedState;
  readonly next: OwnershipRecord | null;
};

export interface Transaction {
  apply(request: {
    readonly operations: readonly FileOperation[];
    readonly record: RecordWrite;
  }): Promise<Result<{ readonly applied: number }, InstallRefusal>>;
}

export interface InstalledDistributions {
  list(): Promise<readonly InstalledDistribution[]>;
}

export interface SiblingRootBlocks {
  read(request: {
    readonly integration: RootIntegration;
    readonly excluding: DistributionId;
  }): Promise<Result<readonly SiblingBlock[], InstallRefusal>>;
}

export interface PayloadSource {
  latest(distribution: DistributionId): Promise<Result<Payload, InstallRefusal>>;
}
