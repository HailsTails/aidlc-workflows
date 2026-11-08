import type { Brand } from "./brand.ts";
import { accepted, refused, type Result } from "./result.ts";

export type RelativePath = Brand<string, "RelativePath">;

export type ContentHash = Brand<string, "ContentHash">;

export type FrameworkVersion = Brand<string, "FrameworkVersion">;

export type DistributionId = Brand<string, "DistributionId">;

export type Timestamp = Brand<string, "Timestamp">;

export type NonEmptyArray<Item> = readonly [Item, ...Item[]];

export type KernelRefusal =
  | { readonly kind: "invalid-relative-path"; readonly raw: string }
  | { readonly kind: "invalid-content-hash"; readonly raw: string }
  | { readonly kind: "invalid-framework-version"; readonly raw: string }
  | { readonly kind: "invalid-distribution-id"; readonly raw: string }
  | { readonly kind: "invalid-timestamp"; readonly raw: string };

const ABSOLUTE_OR_DRIVE = /^(?:\/|[A-Za-z]:)/;
const CONTENT_HASH = /^sha256:[0-9a-f]{64}$/;
const DISTRIBUTION_ID = /^[a-z][a-z0-9-]*$/;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const FRAMEWORK_VERSION =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-preview\.\d{8}\.[1-9]\d*)?$/;

const isEscapingSegment = (segment: string): boolean => segment === ".." || segment === "";

const isRelativePath = (raw: string): boolean =>
  raw.length > 0 &&
  !raw.includes("\\") &&
  !ABSOLUTE_OR_DRIVE.test(raw) &&
  !raw.split("/").some(isEscapingSegment);

export const relativePath = (raw: string): Result<RelativePath, KernelRefusal> =>
  isRelativePath(raw)
    ? accepted(raw as RelativePath)
    : refused({ kind: "invalid-relative-path", raw });

export const contentHash = (raw: string): Result<ContentHash, KernelRefusal> =>
  CONTENT_HASH.test(raw)
    ? accepted(raw as ContentHash)
    : refused({ kind: "invalid-content-hash", raw });

export const frameworkVersion = (raw: string): Result<FrameworkVersion, KernelRefusal> =>
  FRAMEWORK_VERSION.test(raw)
    ? accepted(raw as FrameworkVersion)
    : refused({ kind: "invalid-framework-version", raw });

export const distributionId = (raw: string): Result<DistributionId, KernelRefusal> =>
  DISTRIBUTION_ID.test(raw)
    ? accepted(raw as DistributionId)
    : refused({ kind: "invalid-distribution-id", raw });

export const timestamp = (raw: string): Result<Timestamp, KernelRefusal> =>
  UTC_TIMESTAMP.test(raw)
    ? accepted(raw as Timestamp)
    : refused({ kind: "invalid-timestamp", raw });
