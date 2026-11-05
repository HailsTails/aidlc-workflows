// Sensor documents are complete authored text. This boundary does not parse or
// execute sensor runtime fields; payload placement is supplied by the producer.
import { z } from "zod";
import { renderTokens, residue, type ProjectionFinding } from "./aidlc-projection-text.ts";

const relativePath = z.string().refine((path) =>
  path.length > 0 && !/[\\:]/.test(path) &&
  Array.from(path).every((character) => character.charCodeAt(0) >= 32) &&
  path.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== ".."),
  "expected a relative POSIX path without traversal",
);
export const sensorProjectionContextSchema = z.object({
  harness: z.string().regex(/^[a-z][a-z0-9-]*$/).max(256),
  harnessDir: relativePath,
  rulesSubdir: relativePath,
  invocation: z.string().refine((invocation) => invocation.trim().length > 0, "invocation must not be empty"),
  memoryRoot: relativePath,
});
const requestSchema = z.object({
  subject: z.string(),
  body: z.string(),
  destination: relativePath,
  context: sensorProjectionContextSchema,
  unsupportedTokens: z.array(z.string().min(1)).default([]),
  target: z.object({ harness: z.string(), harnessDir: z.string() }),
});
export type SensorDocument = { readonly path: string; readonly body: string };
export type SensorProjection =
  | { readonly status: "ok"; readonly value: SensorDocument }
  | { readonly status: "invalid"; readonly findings: readonly ProjectionFinding[] };

export function projectSensorDocument(input: unknown): SensorProjection {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return {
    status: "invalid",
    findings: parsed.error.issues.map((issue) => ({
      code: "invalid-input", subject: issue.path.join("."), detail: issue.message,
    })),
  };
  const request = parsed.data;
  if (request.context.harness !== request.target.harness) return {
    status: "invalid", findings: [{ code: "harness-mismatch", subject: request.subject,
      detail: `content for ${request.context.harness}, target for ${request.target.harness}` }],
  };
  if (request.context.harnessDir !== request.target.harnessDir) return {
    status: "invalid", findings: [{ code: "directory-mismatch", subject: request.subject,
      detail: `content for ${request.context.harnessDir}, target for ${request.target.harnessDir}` }],
  };
  const projectedSensorText = renderTokens({ text: request.body, contract: request.context });
  const findings: readonly ProjectionFinding[] = [
    ...residue({ text: projectedSensorText, subject: request.subject }),
    ...request.unsupportedTokens.filter((token) => projectedSensorText.includes(token)).map((token) => ({
      code: "unresolved-token" as const, subject: request.subject,
      detail: `${JSON.stringify(token)} requires declared plugin token projection; not supported for sensors`,
    })),
  ];
  if (findings.length > 0) return { status: "invalid", findings };
  return { status: "ok", value: Object.freeze({ path: request.destination, body: projectedSensorText }) };
}

// Build adapters translate domain failures at the CLI boundary, never into a
// partially projected sensor. Both real producers use this same adapter.
export function requireSensorDocument(input: unknown): SensorDocument {
  const sensorProjection = projectSensorDocument(input);
  if (sensorProjection.status === "invalid") throw new Error(
    sensorProjection.findings.map((finding) => `${finding.subject}: ${finding.code}: ${finding.detail}`).join("\n"),
  );
  return sensorProjection.value;
}
