import { z } from "zod";

export const eslintConfigLookupSchema = z.enum(["nearest-to-file", "repository-root"]);

export type EslintConfigLookup = z.infer<typeof eslintConfigLookupSchema>;
