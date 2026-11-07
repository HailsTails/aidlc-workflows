import { finding, type Outcome } from "../domain/model.ts";
export type TemporaryDirectoryOperations = { readonly allocate: () => Promise<Outcome<string>>; readonly remove: (input: { readonly root: string }) => Promise<Outcome<"removed">> };
const consumeDirectory = async <T>({ root, consume }: { readonly root: string; readonly consume: (input: { readonly root: string }) => Promise<Outcome<T>> }): Promise<Outcome<T>> => {
  try { return await consume({ root }); }
  catch (error) { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "producer-workspace", detail: `private producer work unavailable; no artifact issued: ${error instanceof Error ? error.message : String(error)}` })] }; }
};
export const withTemporaryDirectory = async <T>({ directories, consume }: { readonly directories: TemporaryDirectoryOperations; readonly consume: (input: { readonly root: string }) => Promise<Outcome<T>> }): Promise<Outcome<T>> => {
  try {
    const allocated = await directories.allocate();
    if (allocated.status === "invalid") return allocated;
    const consumed = await consumeDirectory({ root: allocated.value, consume });
    const removed = await directories.remove({ root: allocated.value });
    if (removed.status === "invalid") return consumed.status === "invalid" ? { status: "invalid", findings: [...consumed.findings, ...removed.findings] } : removed;
    return consumed;
  } catch (error) { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "producer-workspace", detail: `private directory lifecycle unavailable; no artifact issued: ${error instanceof Error ? error.message : String(error)}` })] }; }
};
