import type { CoreMethodSources, PreparedMethodFile } from "../../../../../scripts/projection/src/domain/core-method.ts";
import type { SourceBasis } from "../../../../../scripts/projection/src/domain/source-origin.ts";
import type { AuthoredProseContext } from "../../../../../scripts/projection/src/domain/authored-prose.ts";
export const methodBasis: SourceBasis = { source: { kind: "core", id: "framework" }, pin: "1111111111111111111111111111111111111111" };
export const methodContext: AuthoredProseContext = { harness: "claude", directory: ".claude", invocation: "bun .claude/tools/aidlc.ts", rulesSubdir: "rules" };
export const methodSources: CoreMethodSources = { basis: methodBasis, documents: [{ kind: "prose", origin: { ...methodBasis, path: "core/memory/org.md" }, relativePath: "org.md", text: "raw" }], inputs: [{ path: "core/memory/org.md", sha256: "raw-source-digest" }] };
export const methodFiles: readonly PreparedMethodFile[] = [
  { kind: "prose", origin: { ...methodBasis, path: "core/memory/org.md" }, delivery: "workspace-template", path: "aidlc/spaces/default/memory/org.md", text: "prepared" },
  { kind: "prose", origin: { ...methodBasis, path: "core/memory/org.md" }, delivery: "engine-recovery-seed", path: ".claude/tools/data/memory-seed/org.md", text: "prepared" },
];
export const markerSources: CoreMethodSources = { basis: methodBasis, documents: [{ kind: "directory-marker", origin: { ...methodBasis, path: "core/memory/templates/.gitkeep" }, relativePath: "templates/.gitkeep", bytes: new Uint8Array([35, 10]) }], inputs: [{ path: "core/memory/templates/.gitkeep", sha256: "marker-raw-digest" }] };
export const markerFiles: readonly PreparedMethodFile[] = [
  { kind: "directory-marker", origin: { ...methodBasis, path: "core/memory/templates/.gitkeep" }, delivery: "workspace-template", path: "aidlc/spaces/default/memory/templates/.gitkeep", bytes: new Uint8Array([35, 10]) },
  { kind: "directory-marker", origin: { ...methodBasis, path: "core/memory/templates/.gitkeep" }, delivery: "engine-recovery-seed", path: ".claude/tools/data/memory-seed/templates/.gitkeep", bytes: new Uint8Array([35, 10]) },
];
export const methodFailure = { status: "invalid" as const, findings: [{ code: "capability-gap" as const, subject: "method", detail: "method preparation refused" }] };
