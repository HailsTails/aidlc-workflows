import { z } from "zod";
import type { DistributionContextLocation, DistributionContextReader, PreparedDistributionContext } from "../domain/distribution-context.ts";
import type { DistributionSourceOperations } from "./distribution-source.ts";
import { finding, type Outcome } from "../domain/model.ts";
const nativeContextSchema = z.object({ harness: z.object({ schemaVersion: z.literal(1), distribution: z.string(), harnessDir: z.string(), rulesSubdir: z.enum(["rules", "aidlc-rules", "steering"]) }), invocation: z.string().min(1) });
const admitNativeContext = ({ raw, request }: { readonly raw: unknown; readonly request: DistributionContextLocation }): Outcome<PreparedDistributionContext> => {
  const admitted = nativeContextSchema.safeParse(raw);
  if (!admitted.success || admitted.data.harness.distribution !== request.binding.harness || admitted.data.harness.harnessDir !== request.binding.directory) return { status: "invalid", findings: [finding({ code: "harness-mismatch", subject: "prepared-distribution", detail: "unfinished producer metadata must match the requested harness binding and native runtime context" })] };
  return { status: "ok", value: { context: { binding: request.binding, rulesSubdir: admitted.data.harness.rulesSubdir, invocation: admitted.data.invocation }, files: [], inputs: [] } };
};
export const createNativeDistributionContextReader = ({ read }: { readonly read: DistributionSourceOperations["context"] }): DistributionContextReader => ({ load: async (request) => {
  try { return admitNativeContext({ raw: await read({ root: request.location.root, binding: request.binding }), request }); }
  catch (error) { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "prepared-distribution", detail: `native runtime context unavailable: ${error instanceof Error ? error.message : String(error)}` })] }; }
} });
