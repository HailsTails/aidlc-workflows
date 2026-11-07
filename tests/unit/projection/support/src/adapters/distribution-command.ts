import { z } from "zod";
import { finding, type Outcome } from "../../../../../../scripts/projection/src/domain/model.ts";
import type { DistributionSourceLocation } from "../../../../../../scripts/projection/src/adapters/distribution-source.ts";
import { createSourceAssemblyReporter, type SourceAssemblyReporter } from "./source-assembly-reporter.ts";
const argumentsSchema = z.tuple([z.string().min(1), z.string().min(1), z.string().regex(/^[a-f0-9]{40}$/)]);
export const parseDistributionArguments = ({ argv }: { readonly argv: readonly string[] }): Outcome<{ readonly location: DistributionSourceLocation }> => {
  const parsed = argumentsSchema.safeParse(argv);
  if (!parsed.success) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "distribution-archive", detail: "usage: distribution-assembly <trusted-source-root> <complete-seed-root> <source-pin>; writes tar.gz bytes to stdout" })] };
  return { status: "ok", value: { location: { sourceRoot: parsed.data[0], root: parsed.data[1], basis: { source: { kind: "core", id: "framework" }, pin: parsed.data[2] } } } };
};
export type DistributionCommand = { readonly finish: (input: { readonly outcome: Outcome<Uint8Array> }) => Promise<void> };
export type DistributionCommandOperations = { readonly publish: (input: { readonly bytes: Uint8Array }) => Promise<void>; readonly reporter: SourceAssemblyReporter };
export const createDistributionCommandOperations = (): DistributionCommandOperations => ({ publish: async ({ bytes }) => { await Bun.write(Bun.stdout, bytes); }, reporter: createSourceAssemblyReporter() });
export const createDistributionCommand = ({ operations = createDistributionCommandOperations() }: { readonly operations?: DistributionCommandOperations } = {}): DistributionCommand => ({
  finish: async ({ outcome }) => {
    if (outcome.status === "invalid") return operations.reporter.finish({ outcome });
    try { await operations.publish({ bytes: outcome.value }); operations.reporter.finish({ outcome: { status: "ok", value: "" } }); }
    catch (error) { operations.reporter.finish({ outcome: { status: "invalid", findings: [finding({ code: "capability-gap", subject: "distribution-archive", detail: `archive output unavailable: ${error instanceof Error ? error.message : String(error)}` })] } }); }
  },
});
