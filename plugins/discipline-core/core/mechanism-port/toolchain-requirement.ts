import { z } from "zod";
import type { PackageLocationPort, PackageUnlocatable } from "../platform-ports/package-location-port.ts";
import type { Result } from "../values/result.ts";
import type { RunnerFailure } from "./runner-failure.ts";

export type ReleaseLine = {
  readonly floor: string;
  readonly below: string;
};

export type ToolchainRequirement = {
  readonly packageName: string;
  readonly lines: readonly ReleaseLine[];
};

export type PeerToolchain<Modules> = {
  readonly location: PackageLocationPort;
  readonly modules: Modules;
};

export type VersionSupport = "supported" | "unsupported";

type VersionParts = readonly [major: number, minor: number, patch: number];

type Placement = "inside-install" | "outside-install";

type Shadowing = "shadowed" | "unshadowed";

const RELEASE_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

const NOT_INSTALLED = "not installed";

const MODULE_NOT_FOUND = "ERR_MODULE_NOT_FOUND";

const BACKSLASH = /\\/g;

const moduleErrorSchema = z.object({ code: z.string(), message: z.string() });

const releaseParts = (request: { readonly version: string }): VersionParts | undefined => {
  const match = RELEASE_PATTERN.exec(request.version);
  return match === null ? undefined : [Number(match[1]), Number(match[2]), Number(match[3])];
};

const partsOrder = (request: { readonly left: VersionParts; readonly right: VersionParts }): number =>
  request.left[0] - request.right[0] || request.left[1] - request.right[1] || request.left[2] - request.right[2];

const lineSupport = (request: { readonly line: ReleaseLine; readonly found: VersionParts }): VersionSupport => {
  const floor = releaseParts({ version: request.line.floor });
  const below = releaseParts({ version: request.line.below });
  return floor !== undefined &&
    below !== undefined &&
    partsOrder({ left: request.found, right: floor }) >= 0 &&
    partsOrder({ left: request.found, right: below }) < 0
    ? "supported"
    : "unsupported";
};

export const versionSupport = (request: {
  readonly requirement: ToolchainRequirement;
  readonly version: string;
}): VersionSupport => {
  const found = releaseParts({ version: request.version });
  return found !== undefined && request.requirement.lines.some((line) => lineSupport({ line, found }) === "supported")
    ? "supported"
    : "unsupported";
};

const lineRange = (request: { readonly line: ReleaseLine }): string => {
  const floor = releaseParts({ version: request.line.floor });
  return floor !== undefined && request.line.below === `${floor[0] + 1}.0.0`
    ? `^${request.line.floor}`
    : `>=${request.line.floor} <${request.line.below}`;
};

export const supportedRange = (request: { readonly requirement: ToolchainRequirement }): string =>
  request.requirement.lines.map((line) => lineRange({ line })).join(" || ");

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

const slashed = (request: { readonly path: string }): string => request.path.replace(BACKSLASH, "/");

const placementOf = (request: { readonly location: string; readonly installRoot: string }): Placement =>
  slashed({ path: request.location }).startsWith(`${slashed({ path: request.installRoot })}/`)
    ? "inside-install"
    : "outside-install";

const shadowingOf = (request: { readonly resolved: string; readonly location: PackageLocationPort }): Shadowing =>
  request.location.installForm === "package" &&
  placementOf({ location: request.resolved, installRoot: request.location.installRoot }) === "inside-install"
    ? "shadowed"
    : "unshadowed";

type PeerRequest<Module> = {
  readonly requirement: ToolchainRequirement;
  readonly location: PackageLocationPort;
  readonly load: () => Promise<Module>;
  readonly versionOf: (loaded: Module) => string;
};

type FoundPeer<Module> = { readonly loaded: Module; readonly version: string };

const supportedPeer = <Module>(request: {
  readonly requirement: ToolchainRequirement;
  readonly found: FoundPeer<Module>;
}): Result<Module, RunnerFailure> =>
  versionSupport({ requirement: request.requirement, version: request.found.version }) === "supported"
    ? { outcome: "ok", value: request.found.loaded }
    : toolchainUnavailable({ requirement: request.requirement, found: request.found.version });

const versionedPeer = <Module>(request: PeerRequest<Module>): Promise<Result<Module, RunnerFailure>> =>
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

const placedPeer = <Module>(request: PeerRequest<Module> & { readonly resolved: string }): Promise<Result<Module, RunnerFailure>> =>
  shadowingOf({ resolved: request.resolved, location: request.location }) === "shadowed"
    ? Promise.resolve({
        outcome: "failed",
        error: {
          kind: "toolchain-shadowed",
          packageName: request.requirement.packageName,
          location: request.resolved,
          installRoot: request.location.installRoot,
        },
      })
    : versionedPeer(request);

const locatedPeer = <Module>(
  request: PeerRequest<Module> & { readonly located: Result<string, PackageUnlocatable> },
): Promise<Result<Module, RunnerFailure>> =>
  request.located.outcome === "ok"
    ? placedPeer({ ...request, resolved: request.located.value })
    : Promise.resolve(
        toolchainUnavailable({
          requirement: request.requirement,
          found: `unloadable: ${request.located.error.url} (${request.located.error.detail})`,
        }),
      );

export const loadedPeer = <Module>(request: PeerRequest<Module>): Promise<Result<Module, RunnerFailure>> =>
  Promise.resolve()
    .then(() => request.location.locate({ packageName: request.requirement.packageName }))
    .then(
      (located) => locatedPeer({ ...request, located }),
      (thrown: unknown) =>
        toolchainUnavailable({
          requirement: request.requirement,
          found: thrownState({ thrown, packageName: request.requirement.packageName }),
        }),
    );
