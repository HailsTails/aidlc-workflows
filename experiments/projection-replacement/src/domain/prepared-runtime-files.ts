import type { DistributionFile } from "./distribution-artifact.ts";
import { finding, type Outcome, type pathStatus } from "./model.ts";
export type PreparedRuntimeInventory = { readonly files: readonly DistributionFile[]; readonly directories: readonly { readonly path: string }[] };
export type PreparedFileAdditionPlan = { readonly additions: readonly DistributionFile[]; readonly unchanged: readonly string[] };
const runtimeFileFindings = ({ candidate, candidates, inventory, path }: { readonly candidate: DistributionFile; readonly candidates: readonly DistributionFile[]; readonly inventory: PreparedRuntimeInventory; readonly path: typeof pathStatus }) => {
  const existing = inventory.files.find((file) => file.path === candidate.path);
  return [
    ...(path({ path: candidate.path }) === "unsafe" ? [finding({ code: "invalid-destination", subject: candidate.path, detail: "prepared additions require safe relative destinations" })] : []),
    ...(inventory.directories.some((directory) => directory.path === candidate.path || directory.path.startsWith(`${candidate.path}/`)) || inventory.files.some((file) => file.path !== candidate.path && (file.path.startsWith(`${candidate.path}/`) || candidate.path.startsWith(`${file.path}/`))) || candidates.some((other) => other.path !== candidate.path && (other.path.startsWith(`${candidate.path}/`) || candidate.path.startsWith(`${other.path}/`))) ? [finding({ code: "destination-collision", subject: candidate.path, detail: "prepared additions must have unique file destinations without file/directory overlaps" })] : []),
    ...(existing !== undefined && (existing.bytes.length !== candidate.bytes.length || !existing.bytes.every((byte, offset) => byte === candidate.bytes[offset])) ? [finding({ code: "foreign-content", subject: candidate.path, detail: "existing prepared file differs from the candidate; preserve it or prepare a fresh staging tree" })] : []),
  ];
};
export const planPreparedRuntimeFiles = ({ candidates, inventory, rules }: { readonly candidates: readonly DistributionFile[]; readonly inventory: PreparedRuntimeInventory; readonly rules: { readonly path: typeof pathStatus } }): Outcome<PreparedFileAdditionPlan> => {
  if (new Set(inventory.files.map((file) => file.path)).size !== inventory.files.length) return { status: "invalid", findings: [finding({ code: "duplicate", subject: "prepared-runner-inventory", detail: "existing prepared files must have one byte record per path" })] };
  if (new Set(candidates.map((file) => file.path)).size !== candidates.length) return { status: "invalid", findings: [finding({ code: "duplicate", subject: "prepared-runtime-candidates", detail: "prepared byte candidates must have one record per destination" })] };
  if (candidates.some((file) => !Number.isInteger(file.mode) || file.mode < 0 || file.mode > 0o777)) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "prepared-runtime-mode", detail: "prepared byte files require permission modes between 0 and 0777" })] };
  const findings = candidates.flatMap((candidate) => runtimeFileFindings({ candidate, candidates, inventory, path: rules.path }));
  return findings.length > 0 ? { status: "invalid", findings } : { status: "ok", value: { additions: candidates.filter((candidate) => !inventory.files.some((file) => file.path === candidate.path)), unchanged: candidates.filter((candidate) => inventory.files.some((file) => file.path === candidate.path)).map((candidate) => candidate.path) } };
};
