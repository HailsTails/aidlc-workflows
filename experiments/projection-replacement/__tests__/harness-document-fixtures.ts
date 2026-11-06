import { mock } from "bun:test";
import type { HarnessDocumentSources, PreparedHarnessDocuments, PreparedHarnessDocument } from "../src/domain/harness-document.ts";
import type { ProjectionSet } from "../src/application/projection-set.ts";
import type { HarnessDocumentProductServices } from "../examples/harness-document-products.ts";

export const entryBasis = { source: { kind: "core", id: "framework" }, pin: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } as const;
export const entryContext = { harness: "claude", directory: ".claude", invocation: "bun .claude/tools/aidlc.ts", rulesSubdir: "rules", optionLetters: "A-E" } as const;
export const entryManifestOrigin = { ...entryBasis, path: "harness/claude/manifest.ts" };
export const entryHelperOrigin = { ...entryBasis, path: "scripts/earlier-release-regions.ts" };
export const entryMainOrigin = { ...entryBasis, path: "harness/claude/skills/aidlc/SKILL.md" };
export const entryComposerOrigin = { ...entryBasis, path: "harness/claude/skills/aidlc/composer.md" };
export const entryQuestionOrigin = { ...entryBasis, path: "harness/claude/skills/aidlc/question-rendering.md" };
export const entryMethodOrigin = { ...entryBasis, path: "harness/claude/rules-aidlc.md" };
export const entryDigest = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
export const entryManifest = { default: { name: "claude", harnessDir: ".claude", harnessFiles: [
  { src: "skills/aidlc/SKILL.md", dst: "skills/aidlc/SKILL.md" },
  { src: "skills/aidlc/composer.md", dst: "skills/aidlc/composer.md" },
  { src: "skills/aidlc/question-rendering.md", dst: "skills/aidlc/question-rendering.md" },
  { src: "rules-aidlc.md", dst: "rules/aidlc.md" },
  { src: "skills/aidlc/tables.md", dst: "skills/aidlc/tables.md" },
  { src: "settings.json", dst: "settings.json" },
] } };
export const entrySources: HarnessDocumentSources = { documents: [
  { role: "main-skill", origin: entryMainOrigin, text: "Authored main\n\n" },
  { role: "composer", origin: entryComposerOrigin, text: "Authored composer\n" },
  { role: "question-rendering", origin: entryQuestionOrigin, text: "Authored question\n" },
  { role: "method-import", origin: entryMethodOrigin, text: "Authored method\n" },
], authoring: [entryManifestOrigin], inputs: [
  { path: "harness/claude/manifest.ts", sha256: entryDigest },
  { path: "harness/claude/skills/aidlc/SKILL.md", sha256: entryDigest },
  { path: "harness/claude/skills/aidlc/composer.md", sha256: entryDigest },
  { path: "harness/claude/skills/aidlc/question-rendering.md", sha256: entryDigest },
  { path: "harness/claude/rules-aidlc.md", sha256: entryDigest },
] };
export const entryMain: PreparedHarnessDocument = { authored: { role: "main-skill", origin: entryMainOrigin, text: "Authored main\n\n" }, binding: { harness: "claude", directory: ".claude" }, text: "Rendered main\n\nNative compatibility\n", authoring: [entryManifestOrigin, entryHelperOrigin] };
export const entryComposer: PreparedHarnessDocument = { authored: { role: "composer", origin: entryComposerOrigin, text: "Authored composer\n" }, binding: { harness: "claude", directory: ".claude" }, text: "Rendered composer\n", authoring: [entryManifestOrigin, entryHelperOrigin] };
export const entryQuestion: PreparedHarnessDocument = { authored: { role: "question-rendering", origin: entryQuestionOrigin, text: "Authored question\n" }, binding: { harness: "claude", directory: ".claude" }, text: "Rendered question\n", authoring: [entryManifestOrigin, entryHelperOrigin] };
export const entryMethod: PreparedHarnessDocument = { authored: { role: "method-import", origin: entryMethodOrigin, text: "Authored method\n" }, binding: { harness: "claude", directory: ".claude" }, text: "Rendered method\n", authoring: [entryManifestOrigin, entryHelperOrigin] };
export const preparedEntries: PreparedHarnessDocuments = { documents: [entryMain, entryComposer, entryQuestion, entryMethod], inputs: [...entrySources.inputs, { path: "scripts/earlier-release-regions.ts", sha256: entryDigest }] };
export const entryLocation = { sourceRoot: "entry-source", basis: entryBasis, binding: { harness: "claude", directory: ".claude" } } as const;
export const entryPreparation = { sourceRoot: "entry-source", basis: entryBasis, context: entryContext, sources: entrySources };
export const entryResource = { kind: "file", path: ".claude/skills/aidlc/SKILL.md", body: "Rendered main\n\nNative compatibility\n" } as const;
export const entryProjection = { origin: entryMainOrigin, harness: "claude", authoring: [entryManifestOrigin, entryHelperOrigin], resources: [entryResource] } as const;
export const entrySet: ProjectionSet = { scope: "selected-surfaces", target: { harness: "claude", directory: ".claude" }, units: [{ kind: "harness-document", key: "harness-main-skill", projection: entryProjection }], resources: [entryResource] };
export const entrySelection = { target: { harness: "claude", directory: ".claude" }, units: [{ kind: "harness-document", key: "harness-main-skill", input: { document: entryMain, context: { harness: "claude", directory: ".claude" } } }] } as const;
export const createEntrySourceOperations = () => ({
  read: mock().mockResolvedValueOnce({ status: "ok", value: new Uint8Array([77]) }).mockResolvedValueOnce({ status: "ok", value: new TextEncoder().encode("Authored main\n\n") }).mockResolvedValueOnce({ status: "ok", value: new TextEncoder().encode("Authored composer\n") }).mockResolvedValueOnce({ status: "ok", value: new TextEncoder().encode("Authored question\n") }).mockResolvedValueOnce({ status: "ok", value: new TextEncoder().encode("Authored method\n") }).mockResolvedValue({ status: "ok", value: new Uint8Array([77]) }),
  module: mock().mockResolvedValue({ status: "ok", value: entryManifest }), digest: mock().mockReturnValue(entryDigest),
});
export const createEntryNativeText = () => mock().mockReturnValueOnce("Rendered main\n\nNative compatibility\n").mockReturnValueOnce("Rendered composer\n").mockReturnValueOnce("Rendered question\n").mockReturnValue("Rendered method\n");
export const createEntryPreparationOperations = () => ({ read: mock().mockResolvedValue({ status: "ok", value: new Uint8Array([72]) }), module: mock().mockResolvedValue({ status: "ok", value: { prepareEarlierReleaseSkillText: createEntryNativeText() } }), digest: mock().mockReturnValue(entryDigest) });
export const createEntryProse = () => mock().mockReturnValueOnce({ status: "ok", value: "Rendered main\n\n" }).mockReturnValueOnce({ status: "ok", value: "Rendered composer\n" }).mockReturnValueOnce({ status: "ok", value: "Rendered question\n" }).mockReturnValue({ status: "ok", value: "Rendered method\n" });
export const createEntryProductServices = (): HarnessDocumentProductServices => ({ reader: { load: mock().mockResolvedValue({ status: "ok", value: entrySources }) }, preparation: { prepare: mock().mockResolvedValue({ status: "ok", value: preparedEntries }) }, select: mock().mockReturnValue({ status: "ok", value: entrySelection }), project: mock().mockReturnValue({ status: "ok", value: entrySet }), products: mock().mockReturnValue({ status: "ok", value: [] }), rules: { encode: mock() } });
