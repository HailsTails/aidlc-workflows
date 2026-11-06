import { createSqlitePublicationOperations, createSqlitePublicationRepository, type PublicationSession } from "../src/adapters/sqlite-publication.ts";
import { createTemporaryDirectoryOperations } from "../src/adapters/temporary-directory.ts";
import { withTemporaryDirectory } from "../src/application/temporary-directory.ts";
import type { Outcome } from "../src/domain/model.ts";
import type { ProjectionPublication, PublicationSnapshot } from "../src/domain/projection-publication.ts";
import { firstPublication, publicationPayload } from "./publication-fixtures.ts";

export type SqlitePublicationObservation = { readonly attempted: Outcome<PublicationSnapshot>; readonly retained: Outcome<PublicationSnapshot>; readonly store: "present" | "absent" };
const attemptedReadPublication: ProjectionPublication = { ...firstPublication, revision: 2, previous: firstPublication.token, token: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" };
const appendFixturePublication = ({ session, publication }: { readonly session: PublicationSession; readonly publication: ProjectionPublication }): Outcome<PublicationSnapshot> => {
  const appended = session.append({ publication });
  return appended.status === "invalid" ? appended : { status: "ok", value: { head: publication.token, publication } };
};
export const observeSqlitePublicationRead = ({ initialization }: { readonly initialization: "missing" | "empty" | "published" }): Promise<Outcome<SqlitePublicationObservation>> => withTemporaryDirectory({ directories: createTemporaryDirectoryOperations(), consume: async ({ root }) => {
  const path = `${root}/publication.sqlite`;
  const repository = createSqlitePublicationRepository({ path });
  if (initialization === "empty") await Bun.write(path, new Uint8Array());
  if (initialization === "published") {
    const published = await repository.publish({ expectedHead: null, artifactPair: publicationPayload });
    if (published.status === "invalid") return published;
  }
  const attempted = await createSqlitePublicationOperations({ path }).run({ mode: "read", action: ({ session }) => appendFixturePublication({ session, publication: attemptedReadPublication }) });
  return { status: "ok", value: { attempted, retained: await repository.read(), store: await Bun.file(path).exists() ? "present" : "absent" } };
} });
const appendDuplicateFixturePublication = ({ session }: { readonly session: PublicationSession }): Outcome<PublicationSnapshot> => {
  const first = appendFixturePublication({ session, publication: firstPublication });
  if (first.status === "invalid") return first;
  return appendFixturePublication({ session, publication: firstPublication });
};
export const observeSqlitePublicationRollback = (): Promise<Outcome<SqlitePublicationObservation>> => withTemporaryDirectory({ directories: createTemporaryDirectoryOperations(), consume: async ({ root }) => {
  const path = `${root}/publication.sqlite`;
  const attempted = await createSqlitePublicationOperations({ path }).run({ mode: "write", action: appendDuplicateFixturePublication });
  return { status: "ok", value: { attempted, retained: await createSqlitePublicationRepository({ path }).read(), store: await Bun.file(path).exists() ? "present" : "absent" } };
} });
