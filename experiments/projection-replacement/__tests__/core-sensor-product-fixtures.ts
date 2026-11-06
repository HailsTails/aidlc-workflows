import { mock, type Mock } from "bun:test";
import type { SourceBasis } from "../src/domain/source-origin.ts";
import type { AuthoredProseContext } from "../src/domain/authored-prose.ts";
import type { CoreSensorSources, AuthoredSensor } from "../src/domain/sensor-definition.ts";
import type { ProjectionSet, ProjectionSetRequest } from "../src/application/projection-set.ts";
import type { DistributionProduct } from "../src/domain/distribution-products.ts";
import type { CoreSensorProductServices } from "../examples/core-sensor-products.ts";

export const sensorProductBasis: SourceBasis = { source: { kind: "core", id: "framework" }, pin: "1111111111111111111111111111111111111111" };
export const sensorProductContext: AuthoredProseContext = { harness: "claude", directory: ".claude", invocation: "bun .claude/tools/aidlc.ts", rulesSubdir: "rules" };
export const authoredProductSensor: AuthoredSensor = { fileName: "aidlc-traceability.md", origin: { ...sensorProductBasis, path: "core/sensors/aidlc-traceability.md" }, text: "---\nname: Traceability\n---\nRun {{INVOKE}}.\n" };
export const extraProductSensor: AuthoredSensor = { fileName: "aidlc-my-extra-check.md", origin: { ...sensorProductBasis, path: "core/sensors/aidlc-my-extra-check.md" }, text: "Opaque extra sensor" };
export const sensorProductSources: CoreSensorSources = { documents: [authoredProductSensor, extraProductSensor], inputs: [{ path: "core/sensors/aidlc-traceability.md", sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, { path: "core/sensors/aidlc-my-extra-check.md", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }] };
export const sensorProductSelection: ProjectionSetRequest = { target: { harness: "claude", directory: ".claude" }, units: [
  { kind: "sensor", key: "sensor-traceability", input: { document: authoredProductSensor, context: sensorProductContext } },
  { kind: "sensor", key: "sensor-my-extra-check", input: { document: extraProductSensor, context: sensorProductContext } },
] };
export const sensorProductProjection: ProjectionSet = { scope: "selected-surfaces", target: { harness: "claude", directory: ".claude" }, units: [
  { kind: "sensor", key: "sensor-traceability", projection: { origin: authoredProductSensor.origin, harness: "claude", resources: [{ kind: "file", path: ".claude/sensors/aidlc-traceability.md", body: "Rendered" }] } },
  { kind: "sensor", key: "sensor-my-extra-check", projection: { origin: extraProductSensor.origin, harness: "claude", resources: [{ kind: "file", path: ".claude/sensors/aidlc-my-extra-check.md", body: "Extra rendered" }] } },
], resources: [{ kind: "file", path: ".claude/sensors/aidlc-traceability.md", body: "Rendered" }, { kind: "file", path: ".claude/sensors/aidlc-my-extra-check.md", body: "Extra rendered" }] };
export const sensorPreparedProducts: readonly DistributionProduct[] = [
  { key: "sensor-traceability", owner: sensorProductBasis, binding: { harness: "claude", directory: ".claude" }, inputs: [authoredProductSensor.origin], requiredByProducer: [], files: [{ path: ".claude/sensors/aidlc-traceability.md", bytes: new Uint8Array([1]), mode: 0o640 }] },
  { key: "sensor-my-extra-check", owner: sensorProductBasis, binding: { harness: "claude", directory: ".claude" }, inputs: [extraProductSensor.origin], requiredByProducer: [], files: [{ path: ".claude/sensors/aidlc-my-extra-check.md", bytes: new Uint8Array([2]), mode: 0o640 }] },
];
export type SensorProductFixture = { readonly services: {
  readonly reader: { readonly load: Mock<CoreSensorProductServices["reader"]["load"]> };
  readonly select: Mock<CoreSensorProductServices["select"]>;
  readonly project: Mock<CoreSensorProductServices["project"]>;
  readonly products: Mock<CoreSensorProductServices["products"]>;
  readonly rules: { readonly encode: Mock<CoreSensorProductServices["rules"]["encode"]> };
} };
export const createSensorProductFixture = (): SensorProductFixture => ({ services: {
  reader: { load: mock<CoreSensorProductServices["reader"]["load"]>().mockResolvedValue({ status: "ok", value: sensorProductSources }) },
  select: mock<CoreSensorProductServices["select"]>().mockReturnValue({ status: "ok", value: sensorProductSelection }),
  project: mock<CoreSensorProductServices["project"]>().mockReturnValue({ status: "ok", value: sensorProductProjection }),
  products: mock<CoreSensorProductServices["products"]>().mockReturnValue({ status: "ok", value: sensorPreparedProducts }),
  rules: { encode: mock<CoreSensorProductServices["rules"]["encode"]>().mockReturnValue(new Uint8Array([1])) },
} });
