import { releaseBuildVersion } from "../../../core/tools/aidlc-channel.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { ProjectionRefusal } from "../../projection/domain/projection.ts";

export const readBuildVersion = (environment?: Parameters<typeof releaseBuildVersion>[0])
: Result<string, ProjectionRefusal> => {
  try {
    return accepted(releaseBuildVersion(environment));
  } catch (error) {
    return refused({ kind: "render-failed", concept: "host-data", name: "aidlc-version.ts",
      reason: error instanceof Error ? error.message : String(error) });
  }
};
