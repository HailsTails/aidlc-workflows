import { z } from "zod";

const kebab = z.string().regex(/^[a-z][a-z0-9-]*$/);

export const PluginManifestFileSchema = z.object({
  name: kebab,
  version: z.string().min(1),
  description: z.string(),
  dependencies: z.array(z.string()).default(["core"]),
  aidlc: z.object({
    rulesLevel: z.enum(["team", "project"]).default("team"),
    contributes: z.record(z.string(), z.string()),
  }),
});

export type PluginManifestFile = z.infer<typeof PluginManifestFileSchema>;

const fragment = z.strictObject({
  anchor: z.string().min(1),
  order: z.number().int(),
});

export const OverlayFileSchema = z.strictObject({
  target: kebab,
  plugin: kebab,
  adds: z
    .strictObject({
      produces: z.array(kebab).optional(),
      consumes: z
        .array(z.strictObject({ artifact: kebab, required: z.boolean() }))
        .optional(),
      required_sections: z.array(z.string().min(1)).optional(),
    })
    .optional(),
  fragments: z.array(fragment),
});

export type OverlayFile = z.infer<typeof OverlayFileSchema>;
