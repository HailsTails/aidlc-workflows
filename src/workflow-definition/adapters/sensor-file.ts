import { z } from "zod";

export type SensorFieldShapeFile = string | SensorFieldShapesFile[];

export type SensorFieldShapesFile = { [field: string]: SensorFieldShapeFile };

const fieldShapes: z.ZodType<SensorFieldShapesFile> = z.lazy(() =>
  z.record(z.string(), z.union([z.string().min(1), z.array(fieldShapes).length(1)])),
);

export const SensorFileSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  kind: z.literal("deterministic"),
  command: z.string().min(1),
  default_severity: z.enum(["advisory", "blocking"]),
  description: z.string().min(1),
  category: z.string().optional(),
  fire_on: z.enum(["write", "gate"]).default("write"),
  input_schema: fieldShapes.optional(),
  output_schema: fieldShapes.optional(),
  timeout_seconds: z.number().int().positive().optional(),
  matches: z.string().optional(),
});

export type SensorFile = z.infer<typeof SensorFileSchema>;
