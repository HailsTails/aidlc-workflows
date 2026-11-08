import type { Result } from "../../kernel/result.ts";
import type { ContentHash, DistributionId, RelativePath } from "../../kernel/values.ts";
import type { Payload } from "../../packaging/domain/payload.ts";
import type {
  EnvironmentSnapshot,
  InstalledDistribution,
} from "../domain/installed-distribution.ts";
import type { OwnershipRecord } from "../domain/ownership.ts";
import type { InstallRefusal } from "../domain/refusals.ts";

export type ProjectFileState =
  | { readonly kind: "absent" }
  | { readonly kind: "file"; readonly hash: ContentHash; readonly text: string | null }
  | { readonly kind: "link" }
  | { readonly kind: "directory" };

export type ExpectedState =
  | { readonly kind: "absent" }
  | { readonly kind: "hash"; readonly hash: ContentHash };

export type FileOperation =
  | {
      readonly kind: "write";
      readonly path: RelativePath;
      readonly bytes: Uint8Array;
      readonly executable: boolean;
      readonly expected: ExpectedState | null;
    }
  | { readonly kind: "remove"; readonly path: RelativePath; readonly expected: ExpectedState }
  | {
      readonly kind: "link";
      readonly path: RelativePath;
      readonly target: string;
      readonly expected: ExpectedState | null;
    };

export interface ProjectFiles {
  read(path: RelativePath): Promise<ProjectFileState>;
}

export interface OwnershipStore {
  read(harnessDirectory: RelativePath): Promise<Result<OwnershipRecord | null, InstallRefusal>>;
}

export interface Transaction {
  apply(
    operations: readonly FileOperation[],
  ): Promise<Result<{ readonly applied: number }, InstallRefusal>>;
}

export interface InstalledDistributions {
  list(): Promise<readonly InstalledDistribution[]>;
}

export interface PayloadSource {
  latest(request: {
    readonly distribution: DistributionId;
  }): Promise<Result<Payload, InstallRefusal>>;
}

export interface EnvironmentReader {
  snapshot(): EnvironmentSnapshot;
}
