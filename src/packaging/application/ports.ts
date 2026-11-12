import type { FileContent } from "../../kernel/file-content.ts";
import type { Result } from "../../kernel/result.ts";
import type { ContentHash, DistributionId, KernelRefusal } from "../../kernel/values.ts";
import type { ArchiveFormat, PackagingRefusal, ReleaseArtifact } from "../domain/artifact.ts";
import type {
  Channel,
  Payload,
  PayloadFile,
  RuntimeEntryPoint,
} from "../domain/payload.ts";
import type { ReleaseHistory } from "../domain/release-history.ts";

export interface ReleaseHistorySource {
  history(distribution: DistributionId): Promise<Result<ReleaseHistory, PackagingRefusal>>;
}

export interface ToolBundler {
  bundle(request: {
    readonly entries: readonly RuntimeEntryPoint[];
    readonly channel: Channel;
  }): Promise<Result<readonly PayloadFile[], PackagingRefusal>>;
}

export interface ArtifactWriter {
  write(request: {
    readonly name: string;
    readonly format: ArchiveFormat;
    readonly payloads: readonly Payload[];
  }): Promise<Result<ReleaseArtifact, PackagingRefusal>>;
}

export interface ContentHasher {
  hash(content: FileContent): Result<ContentHash, KernelRefusal>;
}
