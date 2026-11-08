import { accept } from "../../kernel/fixtures/accept.ts";
import { expect, test } from "bun:test";
import { methodSource } from "../fixtures/method-source.fixture.ts";
import { readSensor } from "./read-sensor.ts";

const source = { owner: { kind: "core" } as const,
  path: methodSource({ kind: "sensor", within: "aidlc-linter.md" }) };

test("sensor manifests keep structured outputs and the upstream write default", () => {
  const admission = accept(readSensor(source, `---
id: linter
kind: deterministic
command: {{INVOKE}} sensor linter
description: Checks lint
default_severity: blocking
output_schema:
  violations:
    - file: string
      line: number
---
`));
  expect(admission.firesOn).toBe("write");
  expect(admission.command).toBe("{{INVOKE}} sensor linter");
  expect(admission.output).toEqual({ violations: { kind: "list-of", fields: {
    file: { kind: "value", type: "string" }, line: { kind: "value", type: "number" },
  } } });
});
