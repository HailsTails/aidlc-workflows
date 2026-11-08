import { brand, type Brand } from "./brand.ts";
import { accepted, refused, type Result } from "./result.ts";

export type ProjectPath = Brand<string, "ProjectPath">;

export type SourcePath = Brand<string, "SourcePath">;

export type ContentHash = Brand<string, "ContentHash">;

export type FrameworkVersion = Brand<string, "FrameworkVersion">;

export type DistributionId = Brand<string, "DistributionId">;

export type Timestamp = Brand<string, "Timestamp">;

export type NonEmptyArray<Item> = readonly [Item, ...Item[]];

export type PathBase = "project" | "source";

export type KernelRefusal =
  | { readonly kind: "invalid-path"; readonly base: PathBase; readonly raw: string }
  | { readonly kind: "invalid-content-hash"; readonly raw: string }
  | { readonly kind: "invalid-framework-version"; readonly raw: string }
  | { readonly kind: "invalid-distribution-id"; readonly raw: string }
  | { readonly kind: "invalid-timestamp"; readonly raw: string };

const UNPORTABLE_CHARACTER = /[\\:*?"<>|]/;
const FIRST_PRINTABLE_CODE = 0x20;
const TRAILING_DOT_OR_SPACE = /[. ]$/;
const WINDOWS_DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const CONTENT_HASH = /^sha256:[0-9a-f]{64}$/;
const DISTRIBUTION_ID = /^[a-z][a-z0-9-]*$/;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const FRAMEWORK_VERSION =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-preview\.\d{8}\.[1-9]\d*)?$/;

type Portability = "portable" | "unportable";

const segmentPortability = (segment: string): Portability =>
  segment === "" ||
  segment === "." ||
  segment === ".." ||
  UNPORTABLE_CHARACTER.test(segment) ||
  [...segment].some((character) => character.charCodeAt(0) < FIRST_PRINTABLE_CODE) ||
  TRAILING_DOT_OR_SPACE.test(segment) ||
  WINDOWS_DEVICE_NAME.test(segment)
    ? "unportable"
    : "portable";

const pathPortability = (raw: string): Portability =>
  raw.split("/").some((segment) => segmentPortability(segment) === "unportable")
    ? "unportable"
    : "portable";

export const projectPath = (raw: string): Result<ProjectPath, KernelRefusal> =>
  pathPortability(raw) === "portable"
    ? accepted(brand<ProjectPath>(raw))
    : refused({ kind: "invalid-path", base: "project", raw });

export const sourcePath = (raw: string): Result<SourcePath, KernelRefusal> =>
  pathPortability(raw) === "portable"
    ? accepted(brand<SourcePath>(raw))
    : refused({ kind: "invalid-path", base: "source", raw });

export const contentHash = (raw: string): Result<ContentHash, KernelRefusal> =>
  CONTENT_HASH.test(raw)
    ? accepted(brand<ContentHash>(raw))
    : refused({ kind: "invalid-content-hash", raw });

export const frameworkVersion = (raw: string): Result<FrameworkVersion, KernelRefusal> =>
  FRAMEWORK_VERSION.test(raw)
    ? accepted(brand<FrameworkVersion>(raw))
    : refused({ kind: "invalid-framework-version", raw });

export const distributionId = (raw: string): Result<DistributionId, KernelRefusal> =>
  DISTRIBUTION_ID.test(raw)
    ? accepted(brand<DistributionId>(raw))
    : refused({ kind: "invalid-distribution-id", raw });

export const timestamp = (raw: string): Result<Timestamp, KernelRefusal> =>
  UTC_TIMESTAMP.test(raw)
    ? accepted(brand<Timestamp>(raw))
    : refused({ kind: "invalid-timestamp", raw });
