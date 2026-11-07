import { renderAuthoredProse, type AuthoredProseContext } from "./authored-prose.ts";
import type { SourceOrigin, SourceContentDigest } from "./source-origin.ts";
import type { Harness } from "./harness-binding.ts";
import type { NativeResource } from "./native-rendering.ts";
import { finding, type Outcome } from "./model.ts";

export type AuthoredSensor = { readonly fileName: string; readonly origin: SourceOrigin; readonly text: string };
export type CoreSensorSources = { readonly documents: readonly AuthoredSensor[]; readonly inputs: readonly SourceContentDigest[] };
export type SensorProjection = { readonly origin: SourceOrigin; readonly dependencies?: readonly SourceOrigin[]; readonly harness: Harness; readonly resources: readonly NativeResource[] };
export type SensorProjectionInput = { readonly document: AuthoredSensor; readonly context: AuthoredProseContext };
export type SensorProjector = { readonly render: (input: SensorProjectionInput) => Outcome<SensorProjection> };
const admitSensorDelivery = ({ document, context }: SensorProjectionInput): Outcome<SensorProjectionInput> => context.harness !== "claude" || (!context.invocation.startsWith("bun ") && !(context.harness === "claude" && context.directory === ".claude" && context.invocation === "aidlc"))
  ? { status: "invalid", findings: [finding({ code: "capability-gap", subject: document.origin.path, detail: "authored sensor products qualify Claude copy and native delivery; other harness outcomes need their own evidence" })] }
  : { status: "ok", value: { document, context } };
const retainSensorText = ({ input: { document, context }, rendered }: { readonly input: SensorProjectionInput; readonly rendered: Outcome<string> }): Outcome<SensorProjection> => rendered.status === "invalid" ? rendered : { status: "ok", value: { origin: document.origin, harness: context.harness, resources: [{ kind: "file", path: `${context.directory}/sensors/${document.fileName}`, body: rendered.value }] } };
export const createSensorProjector = ({ prose = renderAuthoredProse }: { readonly prose?: typeof renderAuthoredProse } = {}): SensorProjector => ({ render: (input) => {
  const admitted = admitSensorDelivery(input);
  if (admitted.status === "invalid") return admitted;
  const { document, context } = admitted.value;
  const rendered = prose({ markdown: document.text, context, subject: document.origin.path });
  return retainSensorText({ input: admitted.value, rendered });
} });
export const renderSensorDefinition = createSensorProjector().render;
