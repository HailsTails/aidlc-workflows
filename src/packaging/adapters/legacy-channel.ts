import { releaseBuildVersion } from "../../../core/tools/aidlc-channel.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { PackagingRefusal } from "../domain/artifact.ts";

export const readBuildVersion = (environment?: Parameters<typeof releaseBuildVersion>[0])
: Result<string, PackagingRefusal> => {
  try {
    return accepted(releaseBuildVersion(environment));
  } catch (error) {
    return refused({ kind: "version-unstampable",
      reason: error instanceof Error ? error.message : String(error) });
  }
};
