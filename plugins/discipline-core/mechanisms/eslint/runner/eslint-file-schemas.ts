import { z } from "zod";
import { eslintConfigLookupSchema } from "../../../core/values/eslint-config-lookup.ts";

export const packageJsonSchema = z.looseObject({
  scripts: z.record(z.string(), z.string()).optional(),
});

export type PackageJson = z.infer<typeof packageJsonSchema>;

export const suppressionsFileSchema = z.record(
  z.string(),
  z.record(z.string(), z.looseObject({ count: z.number() })),
);

export type SuppressionsFile = z.infer<typeof suppressionsFileSchema>;

export const eslintVersionFileSchema = z.looseObject({ version: z.string() });

export const selectionLookupSchema = z.looseObject({ eslintConfigLookup: eslintConfigLookupSchema.optional() });
