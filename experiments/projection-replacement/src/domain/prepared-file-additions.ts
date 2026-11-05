import type { DistributionFile } from "./distribution-artifact.ts";
import type { NativeResource } from "./native-rendering.ts";
import { collectNativeFiles } from "./native-file-set.ts";
import { finding, type Outcome, type pathStatus } from "./model.ts";
export type PreparedFileAdditionPlan = { readonly additions: readonly DistributionFile[]; readonly unchanged: readonly string[] };
export const planPreparedFileAdditions = ({ candidates, inventory, mode, rules }: { readonly candidates: readonly NativeResource[]; readonly inventory: { readonly files: readonly DistributionFile[]; readonly directories: readonly { readonly path: string }[] }; readonly mode: number; readonly rules: { readonly path: typeof pathStatus; readonly encode: (input: { readonly text: string }) => Uint8Array } }): Outcome<PreparedFileAdditionPlan> => {
  const collected = collectNativeFiles({ resources: candidates });
  if (collected.status === "invalid") return collected;
  const encoded = collected.value.map((candidate) => ({ path: candidate.path, bytes: rules.encode({ text: candidate.body }), mode }));
  const findings = encoded.flatMap((candidate) => {
    const existing = inventory.files.find((file) => file.path === candidate.path);
    return [
      ...(rules.path({ path: candidate.path }) === "unsafe" ? [finding({ code: "invalid-destination", subject: candidate.path, detail: "prepared additions require safe relative destinations" })] : []),
      ...(inventory.directories.some((directory) => directory.path === candidate.path || directory.path.startsWith(`${candidate.path}/`)) || inventory.files.some((file) => file.path !== candidate.path && (file.path.startsWith(`${candidate.path}/`) || candidate.path.startsWith(`${file.path}/`))) || encoded.some((other) => other.path !== candidate.path && (other.path.startsWith(`${candidate.path}/`) || candidate.path.startsWith(`${other.path}/`))) ? [finding({ code: "destination-collision", subject: candidate.path, detail: "prepared additions must have unique file destinations without file/directory overlaps" })] : []),
      ...(existing !== undefined && (existing.bytes.length !== candidate.bytes.length || !existing.bytes.every((byte, offset) => byte === candidate.bytes[offset])) ? [finding({ code: "foreign-content", subject: candidate.path, detail: "existing prepared file differs from the candidate; preserve it or prepare a fresh staging tree" })] : []),
    ];
  });
  if (new Set(inventory.files.map((file) => file.path)).size !== inventory.files.length) return { status: "invalid", findings: [finding({ code: "duplicate", subject: "prepared-runner-inventory", detail: "existing prepared files must have one byte record per path" })] };
  if (!Number.isInteger(mode) || mode < 0 || mode > 0o777) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "prepared-runner-mode", detail: "new prepared files require a permission mode between 0 and 0777" })] };
  return findings.length > 0 ? { status: "invalid", findings } : { status: "ok", value: { additions: encoded.filter((candidate) => !inventory.files.some((file) => file.path === candidate.path)), unchanged: encoded.filter((candidate) => inventory.files.some((file) => file.path === candidate.path)).map((candidate) => candidate.path) } };
};
