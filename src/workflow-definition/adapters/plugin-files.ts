import { z } from "zod";
import { sourcePath } from "../../kernel/values.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { MethodRefusal } from "../domain/refusals.ts";
import { RULE_LEVELS } from "../domain/contribution.ts";

const kebab = z.string().regex(/^[a-z][a-z0-9-]*$/);

const canonical = <Path extends string>(path: Path) => z.literal(path).optional();

const PluginCommandSchema = z.strictObject({
  script: z.string().regex(/^tools\/[^/]+\.ts$/).refine((raw) => sourcePath(raw).ok,
    { message: "Command script must be a portable source path." }),
  description: z.string().min(1),
});

export const PluginManifestFileSchema = z.looseObject({
  name: kebab,
  version: z.string().min(1),
  description: z.string(),
  dependencies: z.array(z.string()).default(["core"]),
  aidlc: z.strictObject({
    marketplace: kebab.optional(),
    rulesLevel: z.enum(RULE_LEVELS).optional(),
    contributes: z.strictObject({
      stages: canonical("stages/"),
      overlays: canonical("contributions/"),
      agents: canonical("agents/"),
      scopes: canonical("scopes/"),
      memory: canonical("memory/"),
      sensors: canonical("sensors/"),
      knowledge: canonical("knowledge/"),
      tools: canonical("tools/"),
    }),
    commands: z.record(kebab, PluginCommandSchema).optional(),
  }),
});

export type PluginManifestFile = z.infer<typeof PluginManifestFileSchema>;

const OVERLAY_ANCHOR =
  /^(?:after-step:\d+|before-step:\d+|end-of-steps|in:.+|after-preflight|end-of-body)$/;

const fragment = z.strictObject({
  anchor: z.string().regex(OVERLAY_ANCHOR),
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
      sensors: z.array(kebab).optional(),
      scopes: z.array(z.string().min(1)).optional(),
      requires_stage: z.array(kebab).optional(),
      required_sections: z.array(z.string().min(1)).optional(),
    })
    .optional(),
  fragments: z.array(fragment),
});

export type OverlayFile = z.infer<typeof OverlayFileSchema>;

export const readPluginManifest = (request: { readonly plugin: string; readonly raw: string }):
  Result<PluginManifestFile, readonly MethodRefusal[]> => {
  const location = { kind: "plugin-manifest" as const, plugin: request.plugin };
  try {
    const decoded = PluginManifestFileSchema.safeParse(JSON.parse(request.raw));
    return decoded.success ? accepted(decoded.data) : refused([{ kind: "invalid-file", location,
      issues: decoded.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) }]);
  } catch {
    return refused([{ kind: "invalid-file", location,
      issues: ["Plugin manifest must contain valid JSON."] }]);
  }
};
