import { expect, test } from "bun:test";
import { sensorCompositionCases } from "../__tests__/sensor-cases.ts";
import { first, successful } from "../__tests__/support.ts";
import { prepareAndProject } from "../src/application/prepare.ts";
import { projectPortable } from "../src/application/portable.ts";
import { integrate } from "../src/domain/integration.ts";
import { sensorTarget } from "../src/adapters/sensor.ts";

test.each([
  ...sensorCompositionCases,
])("composition: $baseline $channel $harness $kind repository sensor descriptor", ({
  input,
  expected,
  resources,
  harness,
  directory,
  sensorDirectory,
}) => {
  const document = first({ entries: successful(prepareAndProject({ input })) });
  expect(document).toMatchObject(expected);
  const native = successful(
    integrate({ document, target: sensorTarget({ harness, directory, sensorDirectory }) }),
  );
  expect(native.resources).toEqual(resources);
});

test.each([
  ...sensorCompositionCases,
])("composition: $baseline $channel $harness $kind portable sensor descriptor", ({
  input,
  expected,
  resources,
  harness,
  directory,
  sensorDirectory,
}) => {
  const document = first({ entries: successful(projectPortable({ json: JSON.stringify(input) })) });
  expect(document).toMatchObject(expected);
  const native = successful(
    integrate({ document, target: sensorTarget({ harness, directory, sensorDirectory }) }),
  );
  expect(native.resources).toEqual(resources);
});
