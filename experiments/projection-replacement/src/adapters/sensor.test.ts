import { expect, test } from "bun:test";
import { projectionFixture } from "../../__tests__/projection-fixtures.ts";
import { sensorTarget } from "./sensor.ts";

test.each([
  { sensorDirectory: ".kiro/sensors", path: ".kiro/sensors/aidlc-linter.md" },
  { sensorDirectory: "sensors", path: "sensors/aidlc-linter.md" },
  {
    sensorDirectory: ".kiro/aidlc-plugins/aidlc-test-pro/sensors",
    path: ".kiro/aidlc-plugins/aidlc-test-pro/sensors/aidlc-linter.md",
  },
])("sensor emission preserves descriptor bytes at $sensorDirectory", ({
  sensorDirectory,
  path,
}) => {
  expect(
    sensorTarget({
      harness: "kiro-ide",
      directory: ".kiro",
      sensorDirectory,
    }).render(
      projectionFixture({
        kind: "text",
        id: "aidlc-linter",
        harness: "kiro-ide",
        harnessDir: ".kiro",
        body: "---\ncommand: bun .kiro/tools/aidlc.ts engine sensor-linter\n---\nSensor \u2014 unchanged.\n",
        description: null,
        nativeTier: null,
        hook: null,
      }),
    ),
  ).toEqual({
    status: "ok",
    value: [
      {
        kind: "file",
        path,
        body: "---\ncommand: bun .kiro/tools/aidlc.ts engine sensor-linter\n---\nSensor \u2014 unchanged.\n",
      },
    ],
  });
});

test("a sensor destination cannot silently accept an agent", () => {
  expect(
    sensorTarget({ harness: "claude", directory: ".claude", sensorDirectory: "sensors" }).render(
      projectionFixture(),
    ),
  ).toEqual({
    status: "invalid",
    findings: [
      {
        code: "unsupported-document-kind",
        subject: "plugin:test-pro/reviewer",
        detail: "sensor descriptors require text documents",
      },
    ],
  });
});
