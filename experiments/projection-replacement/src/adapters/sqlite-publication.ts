import { Database, constants } from "bun:sqlite";
import { z } from "zod";
import { finding, type Outcome } from "../domain/model.ts";
import { inspectPublicationHistory, preparePublication, type ProjectionPublication, type PublicationRepository, type PublicationRules, type PublicationSnapshot } from "../domain/projection-publication.ts";
const createTable = "CREATE TABLE projection_publications (revision INTEGER PRIMARY KEY, previous TEXT, token TEXT NOT NULL, archive BLOB NOT NULL, ownershipJson TEXT NOT NULL)";
const applicationId = 0x41505031;
const stampSchema = z.object({ applicationId: z.number().int() });
const versionSchema = z.object({ schemaVersion: z.number().int() });
const journalSchema = z.object({ journalMode: z.string() });
const tablesSchema = z.array(z.object({ name: z.string(), sql: z.string() }));
const rowSchema = z.array(z.strictObject({ revision: z.number().int().positive(), previous: z.string().regex(/^[a-f0-9]{64}$/).nullable(), token: z.string().regex(/^[a-f0-9]{64}$/), archive: z.instanceof(Uint8Array).refine((bytes) => bytes.length > 0), ownershipJson: z.string().min(1) }));
export type PublicationSession = { readonly rows: () => unknown; readonly append: (input: { readonly publication: ProjectionPublication }) => void };
export type PublicationOperations = { readonly run: (input: { readonly mode: "read" | "write"; readonly action: (input: { readonly session: PublicationSession }) => Outcome<PublicationSnapshot> }) => Promise<Outcome<PublicationSnapshot>> };
const inspectSchema = ({ database, mode }: { readonly database: Database; readonly mode: "read" | "write" }): Outcome<"ready" | "empty"> => {
  const stamp = stampSchema.parse(database.query("SELECT application_id AS applicationId FROM pragma_application_id").get());
  const version = versionSchema.parse(database.query("SELECT user_version AS schemaVersion FROM pragma_user_version").get());
  const tables = tablesSchema.parse(database.query("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all());
  if (journalSchema.parse(database.query("SELECT journal_mode AS journalMode FROM pragma_journal_mode").get()).journalMode !== "delete") return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "projection-publication", detail: "publication journal mode changed; preserve the store instead of publishing without rollback protection" })] };
  if (stamp.applicationId === 0 && version.schemaVersion === 0 && tables.length === 0) {
    if (mode === "read") return { status: "ok", value: "empty" };
    database.exec(createTable); database.exec(`PRAGMA application_id = ${applicationId}`); database.exec("PRAGMA user_version = 1"); return { status: "ok", value: "ready" };
  }
  return stamp.applicationId === applicationId && version.schemaVersion === 1 && tables.length === 1 && tables[0]?.name === "projection_publications" && tables[0].sql === createTable ? { status: "ok", value: "ready" } : { status: "invalid", findings: [finding({ code: "foreign-content", subject: "projection-publication", detail: "publication schema or store identity changed; preserve it instead of initializing or migrating it" })] };
};
const executeSession = ({ database, mode, action }: { readonly database: Database; readonly mode: "read" | "write"; readonly action: (input: { readonly session: PublicationSession }) => Outcome<PublicationSnapshot> }): Outcome<PublicationSnapshot> => {
  const schema = inspectSchema({ database, mode });
  if (schema.status === "invalid") return schema;
  return schema.value === "empty" ? action({ session: createEmptyPublicationSession() }) : action({ session: { rows: () => database.query("SELECT revision, previous, token, archive, ownershipJson FROM projection_publications ORDER BY revision").all(), append: ({ publication }) => { database.query("INSERT INTO projection_publications (revision, previous, token, archive, ownershipJson) VALUES (?, ?, ?, ?, ?)").run(publication.revision, publication.previous, publication.token, publication.archive, publication.ownershipJson); } } });
};
const createEmptyPublicationSession = (): PublicationSession => ({ rows: () => [], append: () => { throw new Error("an uninitialized read-only publication cannot append"); } });
const openPublicationSession = ({ path, mode, action }: { readonly path: string; readonly mode: "read" | "write"; readonly action: Parameters<PublicationOperations["run"]>[0]["action"] }): Outcome<PublicationSnapshot> => {
  const database = new Database(path, (mode === "read" ? constants.SQLITE_OPEN_READWRITE : constants.SQLITE_OPEN_READWRITE | constants.SQLITE_OPEN_CREATE) | constants.SQLITE_OPEN_NOFOLLOW);
  try {
    if (mode === "write") database.exec("PRAGMA synchronous = FULL");
    const transaction = database.transaction(() => executeSession({ database, mode, action }));
    return mode === "write" ? transaction.immediate() : transaction();
  } finally { database.close(); }
};
export const createSqlitePublicationOperations = ({ path }: { readonly path: string }): PublicationOperations => ({
  run: async ({ mode, action }) => {
    try {
      if (path.length === 0 || path === ":memory:" || path.includes("\0")) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "projection-publication", detail: "publication requires a persistent SQLite file path" })] };
      if (mode === "read" && !await Bun.file(path).exists()) return action({ session: createEmptyPublicationSession() });
      return openPublicationSession({ path, mode, action });
    } catch (error) { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "projection-publication", detail: `publication transaction unavailable or rolled back: ${error instanceof Error ? error.message : String(error)}` })] }; }
  },
});
const inspectRows = ({ session, rules }: { readonly session: PublicationSession; readonly rules: PublicationRules }): Outcome<PublicationSnapshot> => {
  const rows = rowSchema.safeParse(session.rows());
  return rows.success ? inspectPublicationHistory({ publications: rows.data.map((row) => ({ revision: row.revision, previous: row.previous, token: row.token, archive: row.archive, ownershipJson: row.ownershipJson })), rules }) : { status: "invalid", findings: [finding({ code: "invalid-input", subject: "projection-publication", detail: "persisted publications require complete archive/ownership pairs and a versioned digest chain" })] };
};
const appendPublication = ({ session, rules, expectedHead, artifactPair }: { readonly session: PublicationSession; readonly rules: PublicationRules; readonly expectedHead: string | null; readonly artifactPair: Parameters<PublicationRepository["publish"]>[0]["artifactPair"] }): Outcome<PublicationSnapshot> => {
  const snapshot = inspectRows({ session, rules });
  if (snapshot.status === "invalid") return snapshot;
  const prepared = preparePublication({ snapshot: snapshot.value, expectedHead, artifactPair, rules });
  if (prepared.status === "invalid") return prepared;
  session.append({ publication: prepared.value });
  return { status: "ok", value: { head: prepared.value.token, publication: prepared.value } };
};
export const createPublicationRules = (): PublicationRules => ({ digest: ({ bytes }) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex"), encode: ({ text }) => new TextEncoder().encode(text) });
export const createSqlitePublicationRepository = ({ path, operations = createSqlitePublicationOperations({ path }), rules = createPublicationRules() }: { readonly path: string; readonly operations?: PublicationOperations; readonly rules?: PublicationRules }): PublicationRepository => ({
  read: () => operations.run({ mode: "read", action: ({ session }) => inspectRows({ session, rules }) }),
  publish: ({ expectedHead, artifactPair }) => operations.run({ mode: "write", action: ({ session }) => appendPublication({ session, rules, expectedHead, artifactPair }) }),
});
