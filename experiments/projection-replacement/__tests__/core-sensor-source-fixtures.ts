import { mock } from "bun:test";
import type { CoreSensorSourceOperations } from "../src/adapters/core-sensor-sources.ts";
export const sensorSourceBasis = { source: { kind: "core", id: "framework" }, pin: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } as const;
export const sensorSourceLocation = { sourceRoot: "authored-sensors", basis: sensorSourceBasis };
export const sensorSourceInventory = [
  { path: "core/sensors/aidlc-check.md", bytes: new Uint8Array([239, 187, 191, 45, 45, 45, 13, 10, 120, 58, 32, 91, 13, 10]) },
  { path: "core/sensors/aidlc-new-check-2.md", bytes: new Uint8Array([65, 10]) },
];
export const sensorSourceExpected = { documents: [
  { fileName: "aidlc-check.md", origin: { ...sensorSourceBasis, path: "core/sensors/aidlc-check.md" }, text: "\uFEFF---\r\nx: [\r\n" },
  { fileName: "aidlc-new-check-2.md", origin: { ...sensorSourceBasis, path: "core/sensors/aidlc-new-check-2.md" }, text: "A\n" },
], inputs: [
  { path: "core/sensors/aidlc-check.md", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  { path: "core/sensors/aidlc-new-check-2.md", sha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" },
] };
export const createCoreSensorSourceFixture = (): CoreSensorSourceOperations => ({ inventory: mock().mockResolvedValue({ status: "ok", value: sensorSourceInventory }), digest: mock().mockReturnValueOnce("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb").mockReturnValue("cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"), decode: mock().mockReturnValueOnce({ status: "ok", value: "\uFEFF---\r\nx: [\r\n" }).mockReturnValue({ status: "ok", value: "A\n" }) });
