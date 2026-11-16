import { z } from "zod";
import type { Result } from "../values/result.ts";
import type { RunnerFailure } from "./runner-failure.ts";

export type ReleaseLine = {
  readonly floor: string;
  readonly stays: "within-major" | "within-minor";
};

export type ToolchainRequirement = {
  readonly packageName: string;
  readonly lines: readonly ReleaseLine[];
};

export type VersionSupport = "supported" | "unsupported";

type VersionParts = readonly [major: number, minor: number, patch: number];

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)/;

const NOT_INSTALLED = "not installed";

const MODULE_NOT_FOUND = "ERR_MODULE_NOT_FOUND";

const moduleErrorSchema = z.object({ code: z.string(), message: z.string() });

const versionParts = (request: { readonly version: string }): VersionParts | undefined => {
  const match = VERSION_PATTERN.exec(request.version);
  return match === null ? undefined : [Number(match[1]), Number(match[2]), Number(match[3])];
};

const partsOrder = (request: { readonly left: VersionParts; readonly right: VersionParts }): number =>
  request.left[0] - request.right[0] || request.left[1] - request.right[1] || request.left[2] - request.right[2];

const sameLine = (request: {
  readonly line: ReleaseLine;
  readonly floor: VersionParts;
  readonly found: VersionParts;
}): VersionSupport => {
  const sameMajor = request.found[0] === request.floor[0];
  const sameMinor = request.found[1] === request.floor[1];
  switch (request.line.stays) {
    case "within-major":
      return sameMajor ? "supported" : "unsupported";
    case "within-minor":
      return sameMajor && sameMinor ? "supported" : "unsupported";
  }
};

const lineSupport = (request: { readonly line: ReleaseLine; readonly found: VersionParts }): VersionSupport => {
  const floor = versionParts({ version: request.line.floor });
  if (floor === undefined || partsOrder({ left: request.found, right: floor }) < 0) {
    return "unsupported";
  }
  return sameLine({ line: request.line, floor, found: request.found });
};

export const versionSupport = (request: {
  readonly requirement: ToolchainRequirement;
  readonly version: string;
}): VersionSupport => {
  const found = versionParts({ version: request.version });
  return found !== undefined && request.requirement.lines.some((line) => lineSupport({ line, found }) === "supported")
    ? "supported"
    : "unsupported";
};

const rangeOperator = (request: { readonly line: ReleaseLine }): string => {
  switch (request.line.stays) {
    case "within-major":
      return "^";
    case "within-minor":
      return "~";
  }
};

export const supportedRange = (request: { readonly requirement: ToolchainRequirement }): string =>
  request.requirement.lines.map((line) => `${rangeOperator({ line })}${line.floor}`).join(" || ");

const toolchainUnavailable = (request: {
  readonly requirement: ToolchainRequirement;
  readonly found: string;
}): Result<never, RunnerFailure> => ({
  outcome: "failed",
  error: {
    kind: "toolchain-unavailable",
    packageName: request.requirement.packageName,
    supported: supportedRange({ requirement: request.requirement }),
    found: request.found,
  },
});

const thrownState = (request: { readonly thrown: unknown; readonly packageName: string }): string => {
  const parsed = moduleErrorSchema.safeParse(request.thrown);
  if (parsed.success && parsed.data.code === MODULE_NOT_FOUND && parsed.data.message.includes(`'${request.packageName}'`)) {
    return NOT_INSTALLED;
  }
  const detail = request.thrown instanceof Error ? request.thrown.message : String(request.thrown);
  return `unloadable: ${detail}`;
};

type FoundPeer<Module> = { readonly loaded: Module; readonly version: string };

const supportedPeer = <Module>(request: {
  readonly requirement: ToolchainRequirement;
  readonly found: FoundPeer<Module>;
}): Result<Module, RunnerFailure> =>
  versionSupport({ requirement: request.requirement, version: request.found.version }) === "supported"
    ? { outcome: "ok", value: request.found.loaded }
    : toolchainUnavailable({ requirement: request.requirement, found: request.found.version });

export const loadedPeer = <Module>(request: {
  readonly requirement: ToolchainRequirement;
  readonly load: () => Promise<Module>;
  readonly versionOf: (loaded: Module) => string;
}): Promise<Result<Module, RunnerFailure>> =>
  Promise.resolve()
    .then(request.load)
    .then((loaded): FoundPeer<Module> => ({ loaded, version: request.versionOf(loaded) }))
    .then(
      (found) => supportedPeer({ requirement: request.requirement, found }),
      (thrown: unknown) =>
        toolchainUnavailable({
          requirement: request.requirement,
          found: thrownState({ thrown, packageName: request.requirement.packageName }),
        }),
    );
