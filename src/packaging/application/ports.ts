import type { Result } from "../../kernel/result.ts";
import type { ContentHash } from "../../kernel/values.ts";
import type { FileContent } from "../../projection/domain/projected-file.ts";
import type { ArchiveFormat, PackagingRefusal, ReleaseArtifact } from "../domain/artifact.ts";
import type { Layout, Payload, PayloadFile, RuntimeEntryPoint } from "../domain/payload.ts";

export interface ToolBundler {
  bundle(request: {
    readonly entries: readonly RuntimeEntryPoint[];
    readonly layout: Layout;
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
  hash(content: FileContent): ContentHash;
}
