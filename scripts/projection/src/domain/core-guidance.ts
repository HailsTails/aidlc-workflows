import type { SourceOrigin, SourceContentDigest } from "./source-origin.ts";
import type { NativeResource } from "./native-rendering.ts";
import type { HarnessBinding } from "./harness-binding.ts";
import { finding, type Outcome } from "./model.ts";
export type GuidancePlacement = { readonly kind: "conductor" } | { readonly kind: "protocol"; readonly slug: string };
export type AuthoredGuidance = { readonly placement: GuidancePlacement; readonly origin: SourceOrigin; readonly text: string };
export type CoreGuidanceSources = { readonly documents: readonly AuthoredGuidance[]; readonly inputs: readonly SourceContentDigest[] };
export type PreparedGuidance = { readonly authored: AuthoredGuidance; readonly text: string; readonly binding: HarnessBinding; readonly authoring: readonly SourceOrigin[] };
export type PreparedCoreGuidance = { readonly documents: readonly PreparedGuidance[]; readonly inputs: readonly SourceContentDigest[] };
export type GuidanceProjection = { readonly origin: SourceOrigin; readonly authoring: readonly SourceOrigin[]; readonly harness: HarnessBinding["harness"]; readonly resources: readonly NativeResource[] };
export type GuidanceProjectionInput = { readonly document: PreparedGuidance; readonly context: HarnessBinding };
export const guidanceDocumentName = ({ placement }: { readonly placement: GuidancePlacement }): string => {
  switch (placement.kind) {
    case "conductor": return "conductor.md";
    case "protocol": return `protocols/${placement.slug}.md`;
  }
};
const admitGuidanceDelivery = ({ document, context }: GuidanceProjectionInput): Outcome<GuidanceProjectionInput> => {
  if (document.binding.harness !== context.harness || document.binding.directory !== context.directory) return { status: "invalid", findings: [finding({ code: "harness-mismatch", subject: document.authored.origin.path, detail: "prepared guidance bindings must match the selected delivery harness" })] };
  return { status: "ok", value: { document, context } };
};
const guidanceResource = ({ document, context }: GuidanceProjectionInput): GuidanceProjection => ({ origin: document.authored.origin, authoring: document.authoring, harness: context.harness, resources: [{ kind: "file", path: `${context.directory}/aidlc-common/${guidanceDocumentName({ placement: document.authored.placement })}`, body: document.text }] });
const continueGuidanceDelivery = ({ admitted, consume }: { readonly admitted: Outcome<GuidanceProjectionInput>; readonly consume: (input: GuidanceProjectionInput) => Outcome<GuidanceProjection> }): Outcome<GuidanceProjection> => admitted.status === "invalid" ? admitted : consume(admitted.value);
export const renderGuidanceDefinition = (input: GuidanceProjectionInput): Outcome<GuidanceProjection> => continueGuidanceDelivery({ admitted: admitGuidanceDelivery(input), consume: (admitted) => ({ status: "ok", value: guidanceResource(admitted) }) });
