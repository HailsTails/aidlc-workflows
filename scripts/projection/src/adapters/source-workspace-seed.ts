import { z } from "zod";
import type { WorkspaceSeedSource } from "../domain/workspace-seed.ts";
import type { RuntimeInputPreparer, RuntimeInputRequest, PreparedRuntimeInput } from "../domain/runtime-inputs.ts";
import { finding, type Outcome } from "../domain/model.ts";
import { prepareWorkspaceSeedInput } from "../application/workspace-seed.ts";
import { createHarnessDocumentSourceOperations, type HarnessDocumentSourceOperations } from "./harness-document-sources.ts";
import { createDistributionAssemblyRules } from "./distribution-source.ts";

const modulePath = "scripts/workspace-seed.ts";
type NativeFreshWorkspaceSeed = () => unknown;
const moduleSchema = z.object({ freshWorkspaceSeed: z.custom<NativeFreshWorkspaceSeed>((capability) => typeof capability === "function") });
const seedSchema = z.strictObject({ file: z.literal("aidlc/active-space"), content: z.string() });
export type SourceWorkspaceSeedServices = { readonly operations: HarnessDocumentSourceOperations; readonly prepare: typeof prepareWorkspaceSeedInput; readonly encode: (input: { readonly text: string }) => Uint8Array };
export const createSourceWorkspaceSeedServices = (): SourceWorkspaceSeedServices => ({ operations: createHarnessDocumentSourceOperations(), prepare: prepareWorkspaceSeedInput, encode: createDistributionAssemblyRules().encode });
const failure = ({ detail, code = "capability-gap" }: { readonly detail: string; readonly code?: "capability-gap" | "foreign-content" | "invalid-input" }): Outcome<never> => ({ status: "invalid", findings: [finding({ code, subject: "source-workspace-seed", detail })] });
const admitWorkspaceSeedRequest = ({ request }: { readonly request: RuntimeInputRequest }): Outcome<RuntimeInputRequest> => {
  if (request.basis.source.kind !== "core" || request.basis.source.id !== "framework" || !/^[a-f0-9]{40}$/.test(request.basis.pin)) return failure({ code: "foreign-content", detail: "fresh workspace seed requires the framework source basis and full source pin" });
  if (!Number.isInteger(request.mode) || request.mode < 0 || request.mode > 0o777) return failure({ code: "invalid-input", detail: "fresh workspace seed requires a file mode between 0 and 0777" });
  return { status: "ok", value: request };
};
const invokeFreshWorkspaceSeed = ({ imported }: { readonly imported: unknown }): Outcome<z.infer<typeof seedSchema>> => {
  const namespace = moduleSchema.safeParse(imported);
  if (!namespace.success) return failure({ detail: "native source must export callable freshWorkspaceSeed; no runtime fallback is substituted" });
  try {
    const seed = seedSchema.safeParse(namespace.data.freshWorkspaceSeed());
    return seed.success ? { status: "ok", value: seed.data } : failure({ detail: "native freshWorkspaceSeed must return only the relative aidlc/active-space file and source-owned text" });
  } catch { return failure({ detail: "native freshWorkspaceSeed unavailable" }); }
};
const retainStableWorkspaceSeed = ({ seed, request, before, after }: { readonly seed: z.infer<typeof seedSchema>; readonly request: RuntimeInputRequest; readonly before: string; readonly after: string }): Outcome<WorkspaceSeedSource> => before !== after ? failure({ code: "foreign-content", detail: "fresh workspace seed source changed during preparation" }) : { status: "ok", value: { ...seed, origin: { ...request.basis, path: modulePath }, sha256: before } };
const readWorkspaceSeed = async ({ request, operations }: { readonly request: RuntimeInputRequest; readonly operations: HarnessDocumentSourceOperations }): Promise<Outcome<WorkspaceSeedSource>> => {
  const before = await operations.read({ sourceRoot: request.sourceRoot, path: modulePath });
  if (before.status === "invalid") return before;
  const sha256 = operations.digest({ bytes: before.value });
  const imported = await operations.module({ sourceRoot: request.sourceRoot, path: modulePath, sha256 });
  if (imported.status === "invalid") return imported;
  const seed = invokeFreshWorkspaceSeed({ imported: imported.value });
  if (seed.status === "invalid") return seed;
  const after = await operations.read({ sourceRoot: request.sourceRoot, path: modulePath });
  return after.status === "invalid" ? after : retainStableWorkspaceSeed({ seed: seed.value, request, before: sha256, after: operations.digest({ bytes: after.value }) });
};
const prepareSourceWorkspaceSeed = async ({ request, services }: { readonly request: RuntimeInputRequest; readonly services: SourceWorkspaceSeedServices }): Promise<Outcome<PreparedRuntimeInput>> => {
  const admitted = admitWorkspaceSeedRequest({ request });
  if (admitted.status === "invalid") return admitted;
  const source = await readWorkspaceSeed({ request: admitted.value, operations: services.operations });
  return source.status === "invalid" ? source : services.prepare({ source: source.value, mode: request.mode, encode: services.encode });
};
export const createSourceWorkspaceSeedPreparer = ({ services = createSourceWorkspaceSeedServices() }: { readonly services?: SourceWorkspaceSeedServices } = {}): RuntimeInputPreparer => ({ prepare: (request) => prepareSourceWorkspaceSeed({ request, services }) });
