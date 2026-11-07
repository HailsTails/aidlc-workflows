import { qualifiedHarnessProfile } from "./qualified-harness-profile.ts";
import { z } from "zod";
import type { HarnessDocumentSources, HarnessDocumentPlacement } from "../domain/harness-document.ts";
import type { SourceBasis, SourceContentDigest } from "../domain/source-origin.ts";
import type { HarnessBinding } from "../domain/harness-binding.ts";
import { finding, pathStatus, type Outcome } from "../domain/model.ts";
import { createOwnershipDigest } from "./projection-ownership.ts";

const manifestPath = (location: HarnessDocumentLocation) => `harness/${location.binding.harness}/manifest.ts`;
const mapping = z.strictObject({ src: z.string(), dst: z.string(), projectRoot: z.boolean().optional() });
const moduleSchema = z.object({ default: z.object({ name: z.string(), harnessDir: z.string(), orchestratorSkillPath: z.string().optional(), harnessFiles: z.array(mapping) }) });
type HarnessMapping = z.infer<typeof mapping>;
export type HarnessDocumentLocation = { readonly sourceRoot: string; readonly basis: SourceBasis; readonly binding: HarnessBinding };
type HarnessDocumentFileRequest = { readonly sourceRoot: string; readonly path: string };
type HarnessDocumentModuleRequest = HarnessDocumentFileRequest & { readonly sha256: string };
export type HarnessDocumentSourceOperations = { readonly read: (input: HarnessDocumentFileRequest) => Promise<Outcome<Uint8Array>>; readonly module: (input: HarnessDocumentModuleRequest) => Promise<Outcome<unknown>>; readonly digest: (input: { readonly bytes: Uint8Array }) => string };
export type HarnessDocumentSourceDependencies = { readonly read?: (input: HarnessDocumentFileRequest) => Promise<Uint8Array>; readonly module?: (input: HarnessDocumentModuleRequest) => Promise<unknown>; readonly digest?: HarnessDocumentSourceOperations["digest"] };
export type HarnessDocumentSourceReader = { readonly load: (input: HarnessDocumentLocation) => Promise<Outcome<HarnessDocumentSources>> };
const readSourceBytes = async ({ request, read }: { readonly request: HarnessDocumentFileRequest; readonly read: NonNullable<HarnessDocumentSourceDependencies["read"]> }): Promise<Outcome<Uint8Array>> => {
  try { return { status: "ok", value: await read(request) }; }
  catch { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: request.path, detail: "authored harness document source file unavailable" })] }; }
};
const importSourceModule = async ({ request, load }: { readonly request: HarnessDocumentModuleRequest; readonly load: NonNullable<HarnessDocumentSourceDependencies["module"]> }): Promise<Outcome<unknown>> => {
  try { return { status: "ok", value: await load(request) }; }
  catch { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: request.path, detail: "authored harness document source module unavailable" })] }; }
};
export const createHarnessDocumentSourceOperations = ({ read = ({ sourceRoot, path }) => Bun.file(`${sourceRoot}/${path}`).bytes(), module: load = ({ sourceRoot, path, sha256 }) => import(`${Bun.pathToFileURL(`${sourceRoot}/${path}`).href}?source=${sha256}`), digest = createOwnershipDigest() }: HarnessDocumentSourceDependencies = {}): HarnessDocumentSourceOperations => ({ read: (request) => readSourceBytes({ request, read }), module: (request) => importSourceModule({ request, load }), digest });
const failure = ({ detail, code = "capability-gap" }: { readonly detail: string; readonly code?: "capability-gap" | "foreign-content" }): Outcome<never> => ({ status: "invalid", findings: [finding({ code, subject: "harness-document-sources", detail })] });
const admitLocation = ({ location }: { readonly location: HarnessDocumentLocation }): Outcome<HarnessDocumentLocation> => {
  if (qualifiedHarnessProfile(location.binding) === null) return failure({ detail: "authored entry documents require a qualified host profile" });
  if (location.basis.source.kind !== "core" || location.basis.source.id !== "framework" || !/^[a-f0-9]{40}$/.test(location.basis.pin)) return failure({ code: "foreign-content", detail: "authored entry documents require the framework source basis and full source pin" });
  return { status: "ok", value: location };
};
const ownedMapping = ({ entry, placement }: { readonly entry: HarnessMapping; readonly placement: HarnessDocumentPlacement }): "matches" | "different" => entry.src === placement.source && entry.dst === placement.destination && entry.projectRoot !== true ? "matches" : "different";
const delegatedMapping = ({ entry }: { readonly entry: HarnessMapping }): "delegated" | "unknown" => entry.src === "skills/aidlc/tables.md" && entry.dst === "skills/aidlc/tables.md" && entry.projectRoot !== true ? "delegated" : "unknown";
const admitMappings = ({ imported, location }: { readonly imported: unknown; readonly location: HarnessDocumentLocation }): Outcome<readonly HarnessDocumentPlacement[]> => {
  const parsed = moduleSchema.safeParse(imported);
  const profile = qualifiedHarnessProfile(location.binding);
  if (!parsed.success || profile === null || parsed.data.default.name !== profile.harness || parsed.data.default.harnessDir !== profile.directory) return failure({ detail: "authored entry documents require the selected host manifest and supported harness file mappings" });
  const entries = parsed.data.default.harnessFiles.filter(entry => /\.md$/i.test(entry.src) || /\.md$/i.test(entry.dst));
  if (profile.entryMapping === "orchestrator") {
    if (entries.length > 0 || parsed.data.default.orchestratorSkillPath !== `${profile.skillRoot}/aidlc/SKILL.md`) return failure({ detail: "orchestrator-owned entry documents require the declared skill root and no competing Markdown mappings" });
    return { status: "ok", value: profile.entryDocuments };
  }
  const placements = profile.entryDocuments.map(placement => ({ ...placement, destination: placement.destination.slice(profile.directory.length + 1) }));
  if (entries.some(entry => pathStatus({ path: entry.src }) !== "safe" || pathStatus({ path: entry.dst }) !== "safe" || delegatedMapping({ entry }) !== "delegated" && !placements.some(placement => ownedMapping({ entry, placement }) === "matches"))) return failure({ detail: "unknown or redirected authored Markdown mapping requires an explicit document owner" });
  if (placements.some(placement => entries.filter(entry => ownedMapping({ entry, placement }) === "matches").length !== 1) || entries.filter(entry => delegatedMapping({ entry }) === "delegated").length > 1) return failure({ detail: "the entry document profile requires each authored mapping exactly once" });
  return { status: "ok", value: profile.entryDocuments };
};
type ObservedHarnessDocument = { readonly placement: HarnessDocumentPlacement; readonly text: string; readonly input: SourceContentDigest };
const decodeDocumentText = ({ path, bytes }: { readonly path: string; readonly bytes: Uint8Array }): Outcome<string> => {
  try { return { status: "ok", value: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes) }; }
  catch { return { status: "invalid", findings: [finding({ code: "invalid-input", subject: path, detail: "authored harness documents require readable UTF-8 source bytes" })] }; }
};
const readDocument = async ({ placement, location, operations }: { readonly placement: HarnessDocumentPlacement; readonly location: HarnessDocumentLocation; readonly operations: HarnessDocumentSourceOperations }): Promise<Outcome<ObservedHarnessDocument>> => {
  const path = `harness/${location.binding.harness}/${placement.source}`;
  const bytes = await operations.read({ sourceRoot: location.sourceRoot, path });
  if (bytes.status === "invalid") return bytes;
  const decoded = decodeDocumentText({ path, bytes: bytes.value });
  return decoded.status === "invalid" ? decoded : { status: "ok", value: { placement, text: decoded.value, input: { path, sha256: operations.digest({ bytes: bytes.value }) } } };
};
const finishDocuments = ({ observed, before, after, location }: { readonly observed: readonly ObservedHarnessDocument[]; readonly before: string; readonly after: string; readonly location: HarnessDocumentLocation }): Outcome<HarnessDocumentSources> => before !== after ? failure({ code: "foreign-content", detail: "Host manifest changed while reading authored entry documents" }) : { status: "ok", value: { documents: observed.map((document) => ({ role: document.placement.role, origin: { ...location.basis, path: document.input.path }, text: document.text })), authoring: [{ ...location.basis, path: manifestPath(location) }], inputs: [{ path: manifestPath(location), sha256: before }, ...observed.map((document) => document.input)] } };
const admitObservedDocuments = ({ observed }: { readonly observed: readonly Outcome<ObservedHarnessDocument>[] }): Outcome<readonly ObservedHarnessDocument[]> => {
  const findings = observed.flatMap((document) => document.status === "invalid" ? document.findings : []);
  return findings.length > 0 ? { status: "invalid", findings } : { status: "ok", value: observed.flatMap((document) => document.status === "ok" ? [document.value] : []) };
};
const readMappedDocuments = async ({ placements, location, operations, before }: { readonly placements: readonly HarnessDocumentPlacement[]; readonly location: HarnessDocumentLocation; readonly operations: HarnessDocumentSourceOperations; readonly before: string }): Promise<Outcome<HarnessDocumentSources>> => {
  const observed = admitObservedDocuments({ observed: await Promise.all(placements.map((placement) => readDocument({ placement, location, operations }))) });
  if (observed.status === "invalid") return observed;
  const after = await operations.read({ sourceRoot: location.sourceRoot, path: manifestPath(location) });
  if (after.status === "invalid") return after;
  return finishDocuments({ observed: observed.value, before, after: operations.digest({ bytes: after.value }), location });
};
const loadDocuments = async ({ location, operations }: { readonly location: HarnessDocumentLocation; readonly operations: HarnessDocumentSourceOperations }): Promise<Outcome<HarnessDocumentSources>> => {
  const bytes = await operations.read({ sourceRoot: location.sourceRoot, path: manifestPath(location) });
  if (bytes.status === "invalid") return bytes;
  const before = operations.digest({ bytes: bytes.value });
  const imported = await operations.module({ sourceRoot: location.sourceRoot, path: manifestPath(location), sha256: before });
  if (imported.status === "invalid") return imported;
  const admitted = admitMappings({ imported: imported.value, location });
  return admitted.status === "invalid" ? admitted : readMappedDocuments({ placements: admitted.value, location, operations, before });
};
export const createHarnessDocumentSourceReader = ({ operations = createHarnessDocumentSourceOperations() }: { readonly operations?: HarnessDocumentSourceOperations } = {}): HarnessDocumentSourceReader => ({ load: async (location) => {
  const admitted = admitLocation({ location });
  return admitted.status === "invalid" ? admitted : loadDocuments({ location: admitted.value, operations });
} });
