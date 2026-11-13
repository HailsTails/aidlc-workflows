import type { ToolBuildLib } from "../adapters/bun-tool-bundler.ts";
import type { Result } from "../../kernel/result.ts";
import type { ToolBundler } from "../application/ports.ts";
import type { PackagingRefusal } from "../domain/artifact.ts";
import type { PayloadFile } from "../domain/payload.ts";

type BundleRequest = Parameters<ToolBundler["bundle"]>[0];

export const createScriptedToolBundler = (outcome: Result<readonly PayloadFile[], PackagingRefusal>) => {
  const requests: BundleRequest[] = [];
  return {
    bundle: async (request: BundleRequest) => { requests.push(request); return outcome; },
    received: (): readonly BundleRequest[] => [...requests],
  };
};

export const createRecordingToolBuild = (outcome: Awaited<ReturnType<ToolBuildLib["build"]>>) => {
  const received: Parameters<ToolBuildLib["build"]>[0][] = [];
  return {
    build: async (options: Parameters<ToolBuildLib["build"]>[0]) => { received.push(options); return outcome; },
    received: (): readonly Parameters<ToolBuildLib["build"]>[0][] => [...received],
  };
};
