import { z } from "zod";

export const packageJsonSchema = z.looseObject({
  scripts: z.record(z.string(), z.string()).optional(),
});

export type PackageJson = z.infer<typeof packageJsonSchema>;

export const suppressionsFileSchema = z.record(
  z.string(),
  z.record(z.string(), z.looseObject({ count: z.number() })),
);

export type SuppressionsFile = z.infer<typeof suppressionsFileSchema>;
