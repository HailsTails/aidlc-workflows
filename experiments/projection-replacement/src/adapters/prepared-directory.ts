import { finding, type Outcome } from "../domain/model.ts";
export type PreparedDirectoryRows = readonly { readonly path: string }[];
export type PreparedDirectoryOperations = { readonly kind: (input: { readonly root: string; readonly path: string }) => Promise<"directory" | "other"> };
export type PreparedDirectoryReader = { readonly read: (input: { readonly root: string; readonly path: string }) => Promise<Outcome<PreparedDirectoryRows>> };
export const createPreparedDirectoryOperations = (): PreparedDirectoryOperations => ({ kind: async ({ root, path }) => (await Bun.file(`${root}/${path}`).stat()).isDirectory() ? "directory" : "other" });
const directoryResult = ({ kind, path }: { readonly kind: "directory" | "other"; readonly path: string }): Outcome<PreparedDirectoryRows> => kind === "directory" ? { status: "ok", value: [{ path }] } : { status: "invalid", findings: [finding({ code: "invalid-input", subject: path, detail: "prepared runner directory path is occupied by a non-directory" })] };
const directoryFailure = ({ error, path }: { readonly error: unknown; readonly path: string }): Outcome<PreparedDirectoryRows> => error instanceof Error && "code" in error && error.code === "ENOENT" ? { status: "ok", value: [] } : { status: "invalid", findings: [finding({ code: "capability-gap", subject: path, detail: "prepared runner directory observation unavailable" })] };
export const createPreparedDirectoryReader = ({ operations = createPreparedDirectoryOperations() }: { readonly operations?: PreparedDirectoryOperations } = {}): PreparedDirectoryReader => ({ read: async ({ root, path }) => {
  try { return directoryResult({ kind: await operations.kind({ root, path }), path }); }
  catch (error) { return directoryFailure({ error, path }); }
} });
