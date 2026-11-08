import { readFileSync } from "node:fs";
import { z } from "zod";
import { CONTEXTS } from "./context-map.ts";

const GlossaryEntrySchema = z.strictObject({
  name: z.string().regex(/^[A-Z][A-Za-z]+$/),
  context: z.enum(CONTEXTS),
  kind: z.enum(["concept", "technical", "port", "use-case", "variant"]),
  definition: z.string().min(1),
  legacy: z.array(z.string().min(1)).optional(),
  of: z.string().optional(),
});

const GlossarySchema = z.array(GlossaryEntrySchema);

export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>;

export const readGlossary = (glossaryPath: URL): readonly GlossaryEntry[] =>
  GlossarySchema.parse(JSON.parse(readFileSync(glossaryPath, "utf8")));
