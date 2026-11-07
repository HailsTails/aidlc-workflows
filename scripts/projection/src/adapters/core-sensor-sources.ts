import { z } from "zod";
import { createAuthoredSourceInventory, type AuthoredSourceInventory } from "./authored-source-inventory.ts";
import { createOwnershipDigest } from "./projection-ownership.ts";
import type { AuthoredSensor, CoreSensorSources } from "../domain/sensor-definition.ts";
import type { SourceBasis, SourceContentDigest } from "../domain/source-origin.ts";
import { finding, type Outcome } from "../domain/model.ts";

const sensorInventorySchema = z.array(z.strictObject({ path: z.string().regex(/^core\/sensors\/aidlc-[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.md$/), bytes: z.instanceof(Uint8Array) })).min(1);
type SensorInventoryEntry = z.infer<typeof sensorInventorySchema>[number];
export type CoreSensorSourceOperations = {
  readonly inventory: (input: { readonly sourceRoot: string }) => Promise<Outcome<unknown>>;
  readonly digest: (input: { readonly bytes: Uint8Array }) => string;
  readonly decode: (input: { readonly bytes: Uint8Array; readonly path: string }) => Outcome<string>;
};
export type CoreSensorSourceDependencies = { readonly inventory?: Pick<AuthoredSourceInventory, "read">; readonly digest?: CoreSensorSourceOperations["digest"]; readonly decode?: CoreSensorSourceOperations["decode"] };
export type CoreSensorSourceReader = { readonly load: (input: { readonly sourceRoot: string; readonly basis: SourceBasis }) => Promise<Outcome<CoreSensorSources>> };
const sourceFailure = ({ detail, code = "capability-gap" }: { readonly detail: string; readonly code?: "capability-gap" | "foreign-content" | "duplicate" }): Outcome<never> => ({ status: "invalid", findings: [finding({ code, subject: "core-sensor-sources", detail })] });
const readRawSensorInventory = async ({ sourceRoot, inventory }: { readonly sourceRoot: string; readonly inventory: Pick<AuthoredSourceInventory, "read"> }): Promise<Outcome<unknown>> => {
  try { return { status: "ok", value: await inventory.read({ sourceRoot, directory: "core/sensors", encoding: "bytes" }) }; }
  catch { return sourceFailure({ detail: "authored core sensor byte inventory unavailable" }); }
};
const decodeSensorBytes = ({ bytes, path }: { readonly bytes: Uint8Array; readonly path: string }): Outcome<string> => {
  try { return { status: "ok", value: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes) }; }
  catch { return { status: "invalid", findings: [finding({ code: "invalid-input", subject: path, detail: "authored core sensors require readable UTF-8 bytes" })] }; }
};
export const createCoreSensorSourceOperations = ({ inventory = createAuthoredSourceInventory(), digest = createOwnershipDigest(), decode = decodeSensorBytes }: CoreSensorSourceDependencies = {}): CoreSensorSourceOperations => ({ inventory: ({ sourceRoot }) => readRawSensorInventory({ sourceRoot, inventory }), digest, decode });
const admitSensorBasis = ({ basis }: { readonly basis: SourceBasis }): Outcome<SourceBasis> => basis.source.kind !== "core" || basis.source.id !== "framework" || !/^[a-f0-9]{40}$/.test(basis.pin)
  ? sourceFailure({ code: "foreign-content", detail: "declare the framework source basis and full source pin before reading authored core sensors" }) : { status: "ok", value: basis };
const admitSensorInventory = ({ candidates }: { readonly candidates: unknown }): Outcome<readonly SensorInventoryEntry[]> => {
  const parsed = sensorInventorySchema.safeParse(candidates);
  if (!parsed.success) return sourceFailure({ detail: "authored core sensors require a nonempty byte inventory of direct core/sensors/aidlc-<canonical>.md files; unsupported entries were not dropped" });
  if (new Set(parsed.data.map((entry) => entry.path)).size !== parsed.data.length) return sourceFailure({ code: "duplicate", detail: "authored core sensor paths must be unique" });
  return { status: "ok", value: parsed.data };
};
type ObservedSensor = { readonly document: AuthoredSensor; readonly input: SourceContentDigest };
const observeSensor = ({ entry, basis, operations }: { readonly entry: SensorInventoryEntry; readonly basis: SourceBasis; readonly operations: CoreSensorSourceOperations }): Outcome<ObservedSensor> => {
  const decoded = operations.decode({ bytes: entry.bytes, path: entry.path });
  return decoded.status === "invalid" ? decoded : { status: "ok", value: { document: { fileName: entry.path.slice("core/sensors/".length), origin: { ...basis, path: entry.path }, text: decoded.value }, input: { path: entry.path, sha256: operations.digest({ bytes: entry.bytes }) } } };
};
const collectSensorSources = ({ observed }: { readonly observed: readonly Outcome<ObservedSensor>[] }): Outcome<CoreSensorSources> => {
  const findings = observed.flatMap((sensor) => sensor.status === "invalid" ? sensor.findings : []);
  return findings.length > 0 ? { status: "invalid", findings } : { status: "ok", value: { documents: observed.flatMap((sensor) => sensor.status === "ok" ? [sensor.value.document] : []), inputs: observed.flatMap((sensor) => sensor.status === "ok" ? [sensor.value.input] : []) } };
};
const loadSensorSources = async ({ sourceRoot, basis, operations }: { readonly sourceRoot: string; readonly basis: SourceBasis; readonly operations: CoreSensorSourceOperations }): Promise<Outcome<CoreSensorSources>> => {
  const candidates = await operations.inventory({ sourceRoot });
  if (candidates.status === "invalid") return candidates;
  const admitted = admitSensorInventory({ candidates: candidates.value });
  return admitted.status === "invalid" ? admitted : collectSensorSources({ observed: admitted.value.map((entry) => observeSensor({ entry, basis, operations })) });
};
export const createCoreSensorSourceReader = ({ operations = createCoreSensorSourceOperations() }: { readonly operations?: CoreSensorSourceOperations } = {}): CoreSensorSourceReader => ({ load: ({ sourceRoot, basis }) => {
  const admitted = admitSensorBasis({ basis });
  return admitted.status === "invalid" ? Promise.resolve(admitted) : loadSensorSources({ sourceRoot, basis: admitted.value, operations });
} });
