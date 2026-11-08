import { describe, expect, test } from "bun:test";
import { SensorFileSchema, type SensorFile } from "./sensor-file.ts";

const linterSensor: Omit<SensorFile, "fire_on"> = {
  id: "linter",
  kind: "deterministic",
  command: "{{INVOKE}} engine sensor-linter",
  default_severity: "advisory",
  description:
    "Wraps the project's configured linter (eslint by default for v0.5.0); fires on TS/JS " +
    "code outputs",
  category: "code-quality",
  matches: "**/*.{ts,js}",
  input_schema: { file_path: "string" },
  output_schema: {
    pass: "boolean",
    violations: [{ file: "string", line: "number", rule: "string", message: "string" }],
  },
  timeout_seconds: 1200,
};

const requiredSectionsSensor: SensorFile = {
  id: "required-sections",
  kind: "deterministic",
  command: "{{INVOKE}} engine sensor-required-sections",
  default_severity: "advisory",
  fire_on: "gate",
  description: "Checks at the gate that stage output contains the required H2 headings",
  category: "document-shape",
  matches: "**/{aidlc-docs,intents,codekb}/**",
  input_schema: { output_path: "string", stage_slug: "string" },
  output_schema: { pass: "boolean", h2_count: "integer", headings: "string[]" },
  timeout_seconds: 300,
};

describe("SensorFileSchema", () => {
  test("reads a sensor that fires on write by default, with a list in its output", () => {
    expect(SensorFileSchema.parse(linterSensor)).toEqual({ ...linterSensor, fire_on: "write" });
  });

  test("reads a sensor that fires at the gate", () => {
    expect(SensorFileSchema.parse(requiredSectionsSensor)).toEqual(requiredSectionsSensor);
  });

  test("refuses a sensor that is not deterministic", () => {
    expect(SensorFileSchema.safeParse({ ...linterSensor, kind: "llm" })).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_value", path: ["kind"] }] },
    });
  });

  test("refuses a severity it does not know", () => {
    expect(
      SensorFileSchema.safeParse({ ...linterSensor, default_severity: "warning" }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_value", path: ["default_severity"] }] },
    });
  });

  test("refuses a list field that describes more than one item shape", () => {
    const sensor = {
      ...linterSensor,
      output_schema: { violations: [{ file: "string" }, { line: "number" }] },
    };
    expect(SensorFileSchema.safeParse(sensor)).toMatchObject({
      success: false,
      error: { issues: [{ path: ["output_schema", "violations"] }] },
    });
  });

  test("refuses a field with an empty type", () => {
    expect(
      SensorFileSchema.safeParse({ ...linterSensor, input_schema: { file_path: "" } }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ path: ["input_schema", "file_path"] }] },
    });
  });

  test("refuses a timeout of zero seconds", () => {
    expect(SensorFileSchema.safeParse({ ...linterSensor, timeout_seconds: 0 })).toMatchObject({
      success: false,
      error: { issues: [{ code: "too_small", path: ["timeout_seconds"] }] },
    });
  });
});
