import type { TemporaryDirectoryOperations } from "../application/temporary-directory.ts";
import { finding } from "../domain/model.ts";
export const createTemporaryDirectoryOperations = (): TemporaryDirectoryOperations => {
  const allocated = new Set<string>();
  return {
    allocate: async () => {
      try { const root = Bun.fileURLToPath(Bun.pathToFileURL(`${process.env["TEMP"] ?? process.env["TMP"] ?? "/tmp"}/aidlc-producer-${crypto.randomUUID()}`)); await Bun.$`mkdir ${root}`.quiet(); allocated.add(root); return { status: "ok", value: root }; }
      catch (error) { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "producer-workspace", detail: `private directory allocation unavailable: ${error instanceof Error ? error.message : String(error)}` })] }; }
    },
    remove: async ({ root }) => {
      if (!allocated.has(root)) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: root, detail: "cleanup requires a root allocated by this directory instance" })] };
      try { await Bun.$`rm -rf ${root}`.quiet(); allocated.delete(root); return { status: "ok", value: "removed" }; }
      catch (error) { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "producer-workspace", detail: `private directory cleanup unavailable: ${error instanceof Error ? error.message : String(error)}` })] }; }
    },
  };
};
