// Fixture transformations and observations only; product calls and expected results stay in the owning tests.
import { mock } from "bun:test";
import cursor from "../../harness/cursor/manifest.ts";
import type { HarnessManifest } from "../../scripts/manifest-types.ts";
import type { ProjectionMetadataPreparation } from "../../scripts/projection/native/projection-metadata.ts";
import type { Outcome } from "../../scripts/projection/src/domain/model.ts";

export const ordinaryCursorResources = cursor.harnessFiles.filter(mapping => !mapping.copyOnly);
export const flaggedCursorResources = cursor.harnessFiles.map((mapping, index) => index === 0 ? { ...mapping, copyOnly: true } : mapping);
const { nativeReplacements: _nativeReplacements, ...withoutReplacements } = cursor;
export const cursorWithoutReplacements = withoutReplacements;
export const rootIntegrationPaths = (declaration: HarnessManifest): string[] => declaration.rootIntegrations.map(integration => integration.path);
export const copyDescriptionFiles = (paths: readonly string[]) => paths.map(path => ({ path, bytes: Buffer.from("copy"), mode: 0o644 }));

// Injected failure must be callable and observable, not a missing capability that fails earlier.
export const createForbiddenDescriptionSpawn = () => mock((): never => { throw new Error("must not spawn"); });

type ObservedDescriptor = Readonly<Record<string, unknown>> & { readonly legacyManagedFileHashes?: unknown; readonly retiredCopyFileHashes?: unknown };

const isDescriptorRecord = (descriptor: unknown): descriptor is ObservedDescriptor => typeof descriptor === "object" && descriptor !== null && !Array.isArray(descriptor);

export function readPreparedDescriptor(preparation: ProjectionMetadataPreparation): ObservedDescriptor {
  if (preparation.kind !== "prepared") throw new Error("descriptor observation requires prepared artifacts");
  const artifact = preparation.artifacts[0];
  if (artifact === undefined) throw new Error("descriptor observation requires an artifact");
  const descriptor: unknown = JSON.parse(Buffer.from(artifact.bytes).toString());
  if (!isDescriptorRecord(descriptor)) throw new Error("descriptor observation requires an object");
  return descriptor;
}

export function requireSuccessfulOutcome<Prepared>(outcome: Outcome<Prepared>): Prepared {
  if (outcome.status !== "ok") throw new Error("fixture observation requires a successful outcome");
  return outcome.value;
}
