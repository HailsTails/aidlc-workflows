import { isClaudeNativeDocumentContext, prepareDocumentCommands } from "../src/adapters/native-document-preparation.ts";
import { createCoreMethodSourceReader, type CoreMethodSourceReader } from "../src/adapters/core-method-sources.ts";
import { createDistributionAssemblyRules } from "../src/adapters/distribution-source.ts";
import { prepareMethodFiles, type PreparedMethodFile } from "../src/domain/core-method.ts";
import { renderAuthoredProse, type AuthoredProseContext } from "../src/domain/authored-prose.ts";
import type { SourceBasis, SourceContentDigest } from "../src/domain/source-origin.ts";
import type { DistributionFile } from "../src/domain/distribution-artifact.ts";
import { continuePreparation } from "../src/application/preparation-result.ts";
import { finding, type Outcome } from "../src/domain/model.ts";
export type PreparedCoreMethodRuntime = { readonly basis: SourceBasis; readonly inputs: readonly SourceContentDigest[]; readonly deliveries: readonly PreparedMethodFile[]; readonly files: readonly DistributionFile[] };
export type CoreMethodRuntimeServices = { readonly reader: CoreMethodSourceReader; readonly prepare: typeof prepareMethodFiles; readonly prose: typeof renderAuthoredProse; readonly encode: (input: { readonly text: string }) => Uint8Array };
export const createCoreMethodRuntimeServices = (): CoreMethodRuntimeServices => ({ reader: createCoreMethodSourceReader(), prepare: prepareMethodFiles, prose: renderAuthoredProse, encode: createDistributionAssemblyRules().encode });
const prepareMethodBytes = ({ delivery, mode, services }: { readonly delivery: PreparedMethodFile; readonly mode: number; readonly services: CoreMethodRuntimeServices }): DistributionFile => ({ path: delivery.path, bytes: delivery.kind === "directory-marker" ? delivery.bytes.slice() : services.encode({ text: delivery.text }), mode });
const admitMethodPreparation = ({ mode, context }: { readonly mode: number; readonly context: AuthoredProseContext }): Outcome<number> => {
  if (!Number.isInteger(mode) || mode < 0 || mode > 0o777) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "core-method-runtime", detail: "prepared method files require permission mode 0..0777" })] };
  if ((!context.invocation.startsWith("bun ") && !isClaudeNativeDocumentContext(context))) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "core-method-runtime", detail: "method preparation qualifies Bun copy and explicit Claude native delivery" })] };
  return { status: "ok", value: mode };
};
export const prepareCoreMethodRuntime = ({ sourceRoot, basis, context, mode, services = createCoreMethodRuntimeServices() }: { readonly sourceRoot: string; readonly basis: SourceBasis; readonly context: AuthoredProseContext; readonly mode: number; readonly services?: CoreMethodRuntimeServices }): Promise<Outcome<PreparedCoreMethodRuntime>> => continuePreparation({ previous: admitMethodPreparation({ mode, context }), consume: async ({ prepared: admittedMode }) => continuePreparation({
  previous: services.reader.load({ sourceRoot, basis }), consume: async ({ prepared: sources }) => continuePreparation({
    previous: services.prepare({ sources, context, prose: services.prose }), consume: async ({ prepared: rendered }) => {
      const commands = prepareDocumentCommands({ sourceRoot, basis, context, documents: rendered.flatMap(delivery => delivery.kind === "prose" ? [{ path: delivery.path, source: delivery.text }] : []) });
      if (commands.status === "invalid") return commands;
      const texts = new Map(commands.value.documents.map(document => [document.path, document.text]));
      const deliveries = rendered.map(delivery => delivery.kind === "prose" ? { ...delivery, text: texts.get(delivery.path) ?? delivery.text } : delivery);
      return { status: "ok", value: { basis: sources.basis, inputs: [...sources.inputs, ...commands.value.inputs], deliveries, files: deliveries.map((delivery) => prepareMethodBytes({ delivery, mode: admittedMode, services })) } };
    },
  }),
}) });
