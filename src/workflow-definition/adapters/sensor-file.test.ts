import { describe, expect, test } from "bun:test";
import { SensorFileSchema } from "./sensor-file.ts";

const LINTER_SENSOR_FIELDS = `
  "id": "linter", "kind": "deterministic", "command": "{{INVOKE}} engine sensor-linter",
  "description": "Wraps the project's configured linter; fires on TS/JS code outputs",
  "category": "code-quality", "default_severity": "advisory", "timeout_seconds": 1200,
  "matches": "**/*.{ts,js}", "input_schema": { "file_path": "string" }, "output_schema": {
    "pass": "boolean",
    "violations": [{ "file": "string", "line": "number", "rule": "string", "message": "string" }]
  }`;

const LINTER_SENSOR = `{${LINTER_SENSOR_FIELDS} }`;

const LINTER_SENSOR_AS_READ = `{${LINTER_SENSOR_FIELDS}, "fire_on": "write" }`;

const REQUIRED_SECTIONS_SENSOR = `{
  "kind": "deterministic", "fire_on": "gate",
  "command": "{{INVOKE}} engine sensor-required-sections", "timeout_seconds": 300,
  "description": "Checks at the gate that stage output contains the required H2 headings",
  "matches": "**/{aidlc-docs,intents,codekb}/**", "default_severity": "advisory",
  "category": "document-shape", "input_schema": { "output_path": "string", "stage_slug": "string" },
  "id": "required-sections", "output_schema": {
    "pass": "boolean", "h2_count": "integer", "headings": "string[]"
  }
}`;

const SENSOR_BASICS = `
  "id": "linter", "command": "{{INVOKE}} engine sensor-linter", "description": "Linter"`;

const VALID_SENSOR_FIELDS = `${SENSOR_BASICS},
  "kind": "deterministic", "default_severity": "advisory"`;

const REFUSED_SENSORS = [
  {
    shape: "a sensor that is not deterministic",
    text: `{${SENSOR_BASICS}, "kind": "llm", "default_severity": "advisory" }`,
    issues: [{ code: "invalid_value", path: ["kind"] }],
  },
  {
    shape: "a severity it does not know",
    text: `{${SENSOR_BASICS}, "kind": "deterministic", "default_severity": "warning" }`,
    issues: [{ code: "invalid_value", path: ["default_severity"] }],
  },
  {
    shape: "a list field that describes more than one item shape",
    text: `{${VALID_SENSOR_FIELDS}, "output_schema": {
      "violations": [{ "file": "string" }, { "line": "number" }] } }`,
    issues: [{ path: ["output_schema", "violations"] }],
  },
  {
    shape: "a field with an empty type",
    text: `{${VALID_SENSOR_FIELDS}, "input_schema": { "file_path": "" } }`,
    issues: [{ path: ["input_schema", "file_path"] }],
  },
  {
    shape: "a timeout of zero seconds",
    text: `{${VALID_SENSOR_FIELDS}, "timeout_seconds": 0 }`,
    issues: [{ code: "too_small", path: ["timeout_seconds"] }],
  },
];

describe("SensorFileSchema", () => {
  test("reads a sensor that fires on write by default, with a list in its output", () => {
    expect(SensorFileSchema.parse(JSON.parse(LINTER_SENSOR))).toEqual(
      JSON.parse(LINTER_SENSOR_AS_READ),
    );
  });

  test("reads a sensor that fires at the gate", () => {
    expect(SensorFileSchema.parse(JSON.parse(REQUIRED_SECTIONS_SENSOR))).toEqual(
      JSON.parse(REQUIRED_SECTIONS_SENSOR),
    );
  });

  test.each(REFUSED_SENSORS)("refuses $shape", ({ text, issues }) => {
    expect(SensorFileSchema.safeParse(JSON.parse(text))).toMatchObject({
      success: false,
      error: { issues },
    });
  });
});
