import { expect, test } from "bun:test";
import { selectCoreSensorProducts, prepareCoreSensorProducts } from "./core-sensor-products.ts";
import type { SourceBasis } from "../src/domain/source-origin.ts";
import type { CoreSensorSources } from "../src/domain/sensor-definition.ts";
import type { AuthoredProseContext } from "../src/domain/authored-prose.ts";
import { createSensorProductFixture, sensorProductBasis, sensorProductContext, authoredProductSensor, extraProductSensor, sensorProductSources, sensorProductSelection, sensorProductProjection, sensorPreparedProducts } from "../__tests__/core-sensor-product-fixtures.ts";

test("selects opaque admitted sensors with stable literal keys and preserved authored provenance", () => {
  expect(selectCoreSensorProducts({ sources: sensorProductSources, basis: sensorProductBasis, context: sensorProductContext })).toEqual({ status: "ok", value: {
    target: { harness: "claude", directory: ".claude" }, units: [
      { kind: "sensor", key: "sensor-traceability", input: { document: { fileName: "aidlc-traceability.md", origin: { source: { kind: "core", id: "framework" }, pin: "1111111111111111111111111111111111111111", path: "core/sensors/aidlc-traceability.md" }, text: "---\nname: Traceability\n---\nRun {{INVOKE}}.\n" }, context: sensorProductContext } },
      { kind: "sensor", key: "sensor-my-extra-check", input: { document: { fileName: "aidlc-my-extra-check.md", origin: { source: { kind: "core", id: "framework" }, pin: "1111111111111111111111111111111111111111", path: "core/sensors/aidlc-my-extra-check.md" }, text: "Opaque extra sensor" }, context: sensorProductContext } },
    ],
  } });
});

const foreignControls: { readonly basis: SourceBasis; readonly sources: CoreSensorSources }[] = [
  { basis: { source: { kind: "plugin", id: "rin" }, pin: "1111111111111111111111111111111111111111" }, sources: sensorProductSources },
  { basis: { source: { kind: "core", id: "other" }, pin: "1111111111111111111111111111111111111111" }, sources: sensorProductSources },
  { basis: sensorProductBasis, sources: { documents: [], inputs: [] } },
  { basis: sensorProductBasis, sources: { documents: [{ ...authoredProductSensor, origin: { ...authoredProductSensor.origin, pin: "2222222222222222222222222222222222222222" } }], inputs: [] } },
  { basis: sensorProductBasis, sources: { documents: [{ ...authoredProductSensor, origin: { ...authoredProductSensor.origin, source: { kind: "plugin", id: "framework" } } }], inputs: [] } },
  { basis: sensorProductBasis, sources: { documents: [authoredProductSensor, { ...extraProductSensor, origin: { ...extraProductSensor.origin, source: { kind: "core", id: "other" } } }], inputs: [] } },
];
test.each(foreignControls)("refuses foreign or empty sensor groups rather than accepting a valid subset", ({ basis, sources }) => {
  expect(selectCoreSensorProducts({ sources, basis, context: sensorProductContext })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "core-sensor-products", detail: "authored core sensors must preserve the selected framework source basis" }] });
});

const unsupportedContexts: AuthoredProseContext[] = [
  { ...sensorProductContext, invocation: "aidlc" },
  { ...sensorProductContext, invocation: "bun arbitrary.ts" },
  { harness: "kiro-ide", directory: ".kiro", invocation: "bun .kiro/tools/aidlc.ts", rulesSubdir: "steering" },
];
test.each(unsupportedContexts)("refuses delivery contexts outside the qualified Claude copy profile", (context) => {
  expect(selectCoreSensorProducts({ sources: sensorProductSources, basis: sensorProductBasis, context })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-sensor-products", detail: "this core sensor producer qualifies Claude Bun-copy definitions; other delivery profiles require separate verified preparation" }] });
});

test("composition passes each admitted result and all required context to the next injected port", async () => {
  const fixture = createSensorProductFixture();
  expect(await prepareCoreSensorProducts({ sourceRoot: "/source", basis: sensorProductBasis, context: sensorProductContext, mode: 0o640, services: fixture.services })).toEqual({ status: "ok", value: { projection: sensorProductProjection, inputs: sensorProductSources.inputs, products: sensorPreparedProducts } });
  expect(fixture.services.reader.load.mock.calls).toEqual([[{ sourceRoot: "/source", basis: sensorProductBasis }]]);
  expect(fixture.services.select.mock.calls).toEqual([[{ sources: sensorProductSources, basis: sensorProductBasis, context: sensorProductContext }]]);
  expect(fixture.services.project.mock.calls).toEqual([[sensorProductSelection]]);
  expect(fixture.services.products.mock.calls).toEqual([[{ projection: sensorProductProjection, sources: [sensorProductBasis], compiler: sensorProductBasis, mode: 0o640, rules: fixture.services.rules }]]);
  expect(fixture.services.rules.encode.mock.calls).toEqual([]);
});

test("reader refusal suppresses selection, projection and product preparation", async () => {
  const fixture = createSensorProductFixture();
  fixture.services.reader.load.mockResolvedValue({ status: "invalid", findings: [{ code: "capability-gap", subject: "source", detail: "sensor source unavailable" }] });
  expect(await prepareCoreSensorProducts({ sourceRoot: "/source", basis: sensorProductBasis, context: sensorProductContext, mode: 0o640, services: fixture.services })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source", detail: "sensor source unavailable" }] });
  expect(fixture.services.select.mock.calls).toEqual([]);
  expect(fixture.services.project.mock.calls).toEqual([]);
  expect(fixture.services.products.mock.calls).toEqual([]);
});

test("selection refusal suppresses both downstream projection and publication products", async () => {
  const fixture = createSensorProductFixture();
  fixture.services.select.mockReturnValue({ status: "invalid", findings: [{ code: "foreign-content", subject: "selection", detail: "foreign source" }] });
  expect(await prepareCoreSensorProducts({ sourceRoot: "/source", basis: sensorProductBasis, context: sensorProductContext, mode: 0o640, services: fixture.services })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "selection", detail: "foreign source" }] });
  expect(fixture.services.project.mock.calls).toEqual([]);
  expect(fixture.services.products.mock.calls).toEqual([]);
});

test("a projection refusal produces no subset of sensor products", async () => {
  const fixture = createSensorProductFixture();
  fixture.services.project.mockReturnValue({ status: "invalid", findings: [{ code: "invalid-input", subject: "projection", detail: "sensor rendering refused" }] });
  expect(await prepareCoreSensorProducts({ sourceRoot: "/source", basis: sensorProductBasis, context: sensorProductContext, mode: 0o640, services: fixture.services })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "projection", detail: "sensor rendering refused" }] });
  expect(fixture.services.project.mock.calls).toEqual([[sensorProductSelection]]);
  expect(fixture.services.products.mock.calls).toEqual([]);
});

test("product preparation refusal retains its finding and does not report partial success", async () => {
  const fixture = createSensorProductFixture();
  fixture.services.products.mockReturnValue({ status: "invalid", findings: [{ code: "invalid-input", subject: "products", detail: "mode refused" }] });
  expect(await prepareCoreSensorProducts({ sourceRoot: "/source", basis: sensorProductBasis, context: sensorProductContext, mode: 0o640, services: fixture.services })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "products", detail: "mode refused" }] });
  expect(fixture.services.products.mock.calls).toEqual([[{ projection: sensorProductProjection, sources: [sensorProductBasis], compiler: sensorProductBasis, mode: 0o640, rules: fixture.services.rules }]]);
});
