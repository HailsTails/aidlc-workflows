import type { HarnessBinding } from "./harness-binding.ts";
import type { SourceBasis } from "./source-origin.ts";
import { finding, type Finding, type pathStatus } from "./model.ts";
export type DistributionFile = { readonly path: string; readonly bytes: Uint8Array; readonly mode: number };
export type DistributionDirectory = { readonly path: string; readonly mode: number };
export type DistributionSeed = { readonly basis: SourceBasis; readonly binding: HarnessBinding; readonly rulesSubdir: "rules" | "aidlc-rules" | "steering"; readonly invocation: string; readonly files: readonly DistributionFile[]; readonly directories: readonly DistributionDirectory[] };
export type AssembledDistribution = { readonly seed: SourceBasis; readonly binding: HarnessBinding; readonly files: readonly DistributionFile[]; readonly directories: readonly DistributionDirectory[]; readonly replaced: readonly string[]; readonly retained: readonly string[] };
export const distributionMetadataPaths = ({ binding }: { readonly binding: HarnessBinding }): readonly string[] => ["aidlc-projection.json", "aidlc-stamp.json", "harness.json"].map((name) => `${binding.directory}/tools/data/${name}`);
export const distributionDirectoryFindings = ({ directories, files, path }: { readonly directories: readonly DistributionDirectory[]; readonly files: readonly DistributionFile[]; readonly path: typeof pathStatus }): readonly Finding[] => directories.flatMap((directory, index) => [
  ...(path({ path: directory.path }) === "unsafe" ? [finding({ code: "invalid-destination", subject: directory.path, detail: "distribution directories require safe relative paths" })] : []),
  ...(!Number.isInteger(directory.mode) || directory.mode < 0 || directory.mode > 0o777 ? [finding({ code: "invalid-input", subject: directory.path, detail: "distribution directories require permission modes between 0 and 0777" })] : []),
  ...(directories.findIndex((candidate) => candidate.path === directory.path) !== index || files.some((file) => file.path === directory.path || directory.path.startsWith(`${file.path}/`)) ? [finding({ code: "destination-collision", subject: directory.path, detail: "distribution directories must be unique and cannot occupy native file paths" })] : []),
]);
