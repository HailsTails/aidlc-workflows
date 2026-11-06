import type { DistributionDirectory } from "./distribution-artifact.ts";
import { finding, type Finding, type Outcome, type pathStatus } from "./model.ts";

export type DistributionStructure = { readonly kind: "file-parents"; readonly mode: number };
export type DistributionStructureRequest = {
  readonly files: readonly { readonly path: string }[];
  readonly retained: readonly DistributionDirectory[];
  readonly mode: number;
  readonly rules: { readonly path: typeof pathStatus };
};

const fileParents = ({ path }: { readonly path: string }): readonly string[] => {
  const segments = path.split("/");
  return segments.slice(0, -1).map((_segment, index) => segments.slice(0, index + 1).join("/"));
};
const inputFindings = ({ files, retained, mode, rules }: DistributionStructureRequest): readonly Finding[] => [
  ...(!Number.isInteger(mode) || mode < 0 || mode > 0o777 ? [finding({ code: "invalid-input", subject: "distribution-structure", detail: "file-parent structure requires an explicit directory mode between 0 and 0777" })] : []),
  ...files.flatMap((file, index) => [
    ...(rules.path({ path: file.path }) === "unsafe" ? [finding({ code: "invalid-destination", subject: file.path, detail: "file-parent structure requires safe relative file paths" })] : []),
    ...(files.findIndex((candidate) => candidate.path.toLowerCase() === file.path.toLowerCase()) !== index ? [finding({ code: "destination-collision", subject: file.path, detail: "file-parent structure requires unique file paths without case aliases" })] : []),
  ]),
  ...retained.flatMap((directory, index) => [
    ...(rules.path({ path: directory.path }) === "unsafe" ? [finding({ code: "invalid-destination", subject: directory.path, detail: "file-parent structure requires safe retained directory paths" })] : []),
    ...(retained.findIndex((candidate) => candidate.path.toLowerCase() === directory.path.toLowerCase()) !== index ? [finding({ code: "destination-collision", subject: directory.path, detail: "file-parent structure requires unique retained directories without case aliases" })] : []),
  ]),
];
const parentFindings = ({ parents, files, retained }: { readonly parents: readonly string[]; readonly files: DistributionStructureRequest["files"]; readonly retained: readonly DistributionDirectory[] }): readonly Finding[] => [
  ...parents.flatMap((parent, index) => [
    ...(parents.findIndex((candidate) => candidate.toLowerCase() === parent.toLowerCase()) !== index ? [finding({ code: "destination-collision", subject: parent, detail: "file-parent directories cannot differ only by case" })] : []),
    ...(files.some((file) => file.path.toLowerCase() === parent.toLowerCase()) ? [finding({ code: "destination-collision", subject: parent, detail: "a distribution file cannot also be a parent directory" })] : []),
  ]),
  ...retained.flatMap((directory): readonly Finding[] => {
    if (files.some((file) => directory.path.toLowerCase() === file.path.toLowerCase() || directory.path.toLowerCase().startsWith(`${file.path.toLowerCase()}/`))) return [finding({ code: "destination-collision", subject: directory.path, detail: "retained directories cannot occupy or descend from a distribution file" })];
    if (parents.includes(directory.path)) return [];
    if (parents.some((parent) => parent.toLowerCase() === directory.path.toLowerCase())) return [finding({ code: "destination-collision", subject: directory.path, detail: "retained directory spelling must match final file parents" })];
    return [finding({ code: "capability-gap", subject: directory.path, detail: "file-parent structure cannot retire an explicit directory without a final descendant file" })];
  }),
];
const prepareParents = ({ files, retained, mode }: DistributionStructureRequest): Outcome<readonly DistributionDirectory[]> => {
  const parents = [...new Set(files.flatMap((file) => fileParents({ path: file.path })))].sort();
  const findings = parentFindings({ parents, files, retained });
  return findings.length > 0 ? { status: "invalid", findings } : { status: "ok", value: parents.map((path) => ({ path, mode })) };
};
export const prepareDistributionStructure = (request: DistributionStructureRequest): Outcome<readonly DistributionDirectory[]> => {
  const findings = inputFindings(request);
  return findings.length > 0 ? { status: "invalid", findings } : prepareParents(request);
};
