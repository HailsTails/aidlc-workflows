import type { Finding } from "./outcome.ts";

export type KernelExport = {
  readonly file: string;
  readonly name: string;
};

const STAY_IDENTITY_ONLY =
  "src/kernel holds shared identity values only. Declare this in the domain of the " +
  "context that owns the concept (src/glossary.json names it) and import it from there; " +
  "never widen the kernel into a shared bucket.";

export const judgeKernelSurface = (request: {
  readonly recorded: readonly string[];
  readonly measured: readonly KernelExport[];
}): readonly Finding[] => {
  const allowed = new Set(request.recorded);
  return request.measured
    .filter((entry) => !allowed.has(entry.name))
    .map((entry) => ({
      subject: `${entry.file} · ${entry.name}`,
      violation: "is a new export from the shared kernel",
      fix: STAY_IDENTITY_ONLY,
    }));
};

export const narrowedSurface = (request: {
  readonly recorded: readonly string[];
  readonly measured: readonly KernelExport[];
}): readonly string[] => {
  const present = new Set(request.measured.map((entry) => entry.name));
  return request.recorded.filter((name) => present.has(name));
};
