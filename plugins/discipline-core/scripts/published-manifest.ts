import { z } from "zod";
import { parsedJson } from "../core/rule-set-reader/rule-set-reader.ts";
import type { Result } from "../core/values/result.ts";
import type { PackageIdentity } from "./package-identity.ts";
import type { CommandEntries } from "./package-plan.ts";

export type ManifestFailure = { readonly kind: "manifest-invalid"; readonly detail: string };

const versionsSchema = z.record(z.string(), z.string());

const publishedSectionsSchema = z.object({
  version: z.string(),
  license: z.string(),
  peerDependencies: versionsSchema,
  peerDependenciesMeta: z.record(z.string(), z.object({ optional: z.boolean() })),
});

const peerSectionsSchema = publishedSectionsSchema.pick({ peerDependencies: true });
const MANIFEST_EXPORT = "./package.json";

const exportPathOf = (path: string): string => `./${path}`;

const manifestText = (request: { readonly manifest: object }): string => `${JSON.stringify(request.manifest, null, 2)}\n`;

const sectionsOf = <Sections>(request: {
  readonly developmentManifest: string;
  readonly schema: z.ZodType<Sections>;
}): Result<Sections, ManifestFailure> => {
  const parsed = parsedJson({ text: request.developmentManifest });
  if (parsed.outcome === "failed") {
    return { outcome: "failed", error: { kind: "manifest-invalid", detail: parsed.error } };
  }
  const sections = request.schema.safeParse(parsed.value);
  return sections.success
    ? { outcome: "ok", value: sections.data }
    : { outcome: "failed", error: { kind: "manifest-invalid", detail: sections.error.message } };
};

export const peerNamesOf = (request: {
  readonly developmentManifest: string;
}): Result<readonly string[], ManifestFailure> => {
  const peers = sectionsOf({ developmentManifest: request.developmentManifest, schema: peerSectionsSchema });
  return peers.outcome === "failed" ? peers : { outcome: "ok", value: Object.keys(peers.value.peerDependencies) };
};

export const publishManifestOf = (request: {
  readonly developmentManifest: string;
  readonly identity: PackageIdentity;
  readonly commands: CommandEntries;
  readonly files: readonly string[];
  readonly exported: readonly string[];
  readonly nodeRange: string;
}): Result<string, ManifestFailure> => {
  const published = sectionsOf({ developmentManifest: request.developmentManifest, schema: publishedSectionsSchema });
  if (published.outcome === "failed") {
    return published;
  }
  return {
    outcome: "ok",
    value: manifestText({
      manifest: {
        name: request.identity.name,
        version: published.value.version,
        description: request.identity.description,
        license: published.value.license,
        type: "module",
        bin: { [request.identity.checkBin]: request.commands.check, [request.identity.projectBin]: request.commands.project },
        exports: Object.fromEntries([MANIFEST_EXPORT, ...request.exported.map(exportPathOf)].map((path) => [path, path])),
        files: request.files,
        engines: { node: request.nodeRange },
        peerDependencies: published.value.peerDependencies,
        peerDependenciesMeta: published.value.peerDependenciesMeta,
      },
    }),
  };
};
