import { z } from "zod";
import { createNativeCompilerProcessOperations, compilerSystemEnvironment, type NativeCompilerProcessOperations } from "./native-compiler-process.ts";
import { createTemporaryDirectoryOperations } from "./temporary-directory.ts";
import { withTemporaryDirectory, type TemporaryDirectoryOperations } from "../application/temporary-directory.ts";
import { createOwnershipDigest } from "./projection-ownership.ts";
import type { SourceBasis, SourceOrigin } from "../domain/source-origin.ts";
import type { DeclaredStageRoles, RoleFrontend } from "../domain/plugin-role-contract.ts";
import { finding, pathStatus, type Outcome } from "../domain/model.ts";
export type RoleSourceDocument = { readonly origin: SourceOrigin; readonly text: string };
export type PluginRoleFrontend = { readonly read: (input: { readonly documents: readonly RoleSourceDocument[] }) => Promise<Outcome<{ readonly frontend: RoleFrontend; readonly stages: readonly DeclaredStageRoles[] }>> };
const entries = ["core/tools/aidlc-lib.ts", "core/tools/aidlc-stage-schema.ts"] as const;
const sha256 = z.string().regex(/^[a-f0-9]{64}$/), slug = z.string().regex(/^[a-z][a-z0-9-]*$/);
const replySchema = z.discriminatedUnion("status", [z.strictObject({ status: z.literal("ok"), inputs: z.array(z.strictObject({ path: z.string(), sha256 })), stages: z.array(z.strictObject({ path: z.string(), sha256, slug, mode: slug, plugin: slug, lead: slug, supports: z.array(slug), reviewer: slug.nullable() })) }), z.strictObject({ status: z.enum(["unavailable", "refused"]), detail: z.string() })]);
const program = `
const input = await Bun.stdin.json();
const entries = ["core/tools/aidlc-lib.ts", "core/tools/aidlc-stage-schema.ts"];
const prepare = async () => {
  if ((await Promise.all(entries.map(path => Bun.file(input.source + "/" + path).exists()))).some(exists => !exists)) return { status: "unavailable", detail: "authored role frontend requires source aidlc-lib.ts and aidlc-stage-schema.ts" };
  const fingerprint = async () => Promise.all(entries.map(async path => ({ path, sha256: new Bun.CryptoHasher("sha256").update(await Bun.file(input.source + "/" + path).bytes()).digest("hex") })));
  const before = await fingerprint();
  const lib = await import(Bun.pathToFileURL(input.source + "/core/tools/aidlc-lib.ts").href);
  const schema = await import(Bun.pathToFileURL(input.source + "/core/tools/aidlc-stage-schema.ts").href);
  if (typeof lib.parseStageFrontmatter !== "function" || typeof schema.validateStageFrontmatter !== "function") return { status: "unavailable", detail: "source does not export the authored stage frontend; no alternate YAML grammar was used" };
  const parsed = input.documents.map(document => {
    try {
      const declaration = lib.parseStageFrontmatter(document.text), checked = schema.validateStageFrontmatter(declaration);
      if (!checked.valid) return { status: "refused", detail: document.origin.path + ": " + checked.errors.join("; ") };
      if (declaration.plugin !== document.origin.source.id) return { status: "refused", detail: document.origin.path + ": declared plugin does not match source owner" };
      return { status: "ok", stage: { path: document.origin.path, sha256: new Bun.CryptoHasher("sha256").update(document.text).digest("hex"), slug: declaration.slug, mode: declaration.mode, plugin: declaration.plugin, lead: declaration.lead_agent, supports: declaration.support_agents, reviewer: declaration.reviewer ?? null } };
    } catch (error) { return { status: "refused", detail: document.origin.path + ": " + String(error) }; }
  });
  const failed = parsed.find(entry => entry.status !== "ok");
  if (failed) return failed;
  const after = await fingerprint();
  if (JSON.stringify(before) !== JSON.stringify(after)) return { status: "unavailable", detail: "stage frontend changed during source role preparation" };
  return { status: "ok", inputs: after, stages: parsed.map(entry => entry.stage) };
};
process.stdout.write(JSON.stringify(await prepare()));
`;
const admitRoles = ({ decoded, documents, basis, digest }: { readonly decoded: unknown; readonly documents: readonly RoleSourceDocument[]; readonly basis: SourceBasis; readonly digest: (input: { readonly bytes: Uint8Array }) => string }): Outcome<{ readonly frontend: RoleFrontend; readonly stages: readonly DeclaredStageRoles[] }> => {
  const parsed = replySchema.safeParse(decoded);
  if (!parsed.success) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "plugin-role-frontend", detail: "source frontend must return every role declaration with input and parser witnesses, or explicit diagnostics" })] };
  if (parsed.data.status !== "ok") return { status: "invalid", findings: [finding({ code: parsed.data.status === "unavailable" ? "capability-gap" : "invalid-input", subject: "plugin-role-frontend", detail: parsed.data.detail })] };
  const reply = parsed.data;
  if (reply.stages.length !== documents.length || new Set(reply.stages.map((stage) => stage.path)).size !== reply.stages.length || reply.stages.some((stage) => !documents.some((document) => document.origin.path === stage.path && stage.plugin === document.origin.source.id && stage.sha256 === digest({ bytes: new TextEncoder().encode(document.text) }))) || reply.inputs.length !== entries.length || entries.some((path) => reply.inputs.filter((entry) => entry.path === path).length !== 1)) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "plugin-role-frontend", detail: "role declarations must match every requested source path and input byte string, with both frontend entrypoint witnesses" })] };
  return { status: "ok", value: { frontend: { origin: { ...basis, path: "core/tools/aidlc-lib.ts" }, inputs: reply.inputs }, stages: reply.stages.flatMap((stage) => { const document = documents.find((document) => document.origin.path === stage.path); return document === undefined ? [] : [{ origin: document.origin, sha256: stage.sha256, slug: stage.slug, mode: stage.mode, lead: stage.lead, supports: stage.supports, reviewer: stage.reviewer }]; }) } };
};
export const createPluginRoleFrontend = ({ sourceRoot, basis, binary = "bun", operations = createNativeCompilerProcessOperations(), directories = createTemporaryDirectoryOperations(), digest = createOwnershipDigest() }: { readonly sourceRoot: string; readonly basis: SourceBasis; readonly binary?: string; readonly operations?: NativeCompilerProcessOperations; readonly directories?: TemporaryDirectoryOperations; readonly digest?: (input: { readonly bytes: Uint8Array }) => string }): PluginRoleFrontend => ({ read: ({ documents }) => withTemporaryDirectory({ directories, consume: async ({ root }) => {
  if (basis.source.kind !== "core" || basis.source.id !== "framework" || documents.length === 0 || new Set(documents.map((document) => document.origin.path)).size !== documents.length || documents.some((document) => document.origin.source.kind !== "plugin" || pathStatus({ path: document.origin.path }) === "unsafe")) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "plugin-role-frontend", detail: "use a trusted framework frontend and nonempty unique plugin stage source documents" })] };
  const source = Bun.fileURLToPath(Bun.pathToFileURL(sourceRoot)), env = { ...compilerSystemEnvironment({ inherited: operations.environment() }), ...Object.fromEntries([["HOME", root], ["USERPROFILE", root], ["APPDATA", root], ["LOCALAPPDATA", root], ["AIDLC_RUNTIME_PROJECT_DIR", root], ["AIDLC_PROJECT_DIR", root]]) };
  const reply = operations.spawn({ binary, args: ["--no-install", "--eval", program], cwd: root, env, input: JSON.stringify({ source, documents }) });
  if (reply.error !== null || reply.exitCode !== 0 || reply.stderr.trim().length > 0) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "plugin-role-frontend", detail: `source role frontend unavailable or reported diagnostics: ${reply.error ?? reply.stderr.trim()}` })] };
  try { return admitRoles({ decoded: JSON.parse(reply.stdout), documents, basis, digest }); }
  catch { return { status: "invalid", findings: [finding({ code: "invalid-json", subject: "plugin-role-frontend", detail: "source frontend must return one JSON response" })] }; }
} }) });
