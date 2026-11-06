import type { WorkspaceSeedSource } from "../domain/workspace-seed.ts";
import type { PreparedRuntimeInput } from "../domain/runtime-inputs.ts";
import { finding, type Outcome } from "../domain/model.ts";
export const prepareWorkspaceSeedInput = ({ source, mode, encode }: { readonly source: WorkspaceSeedSource; readonly mode: number; readonly encode: (input: { readonly text: string }) => Uint8Array }): Outcome<PreparedRuntimeInput> => {
  if (!Number.isInteger(mode) || mode < 0 || mode > 0o777) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "workspace-seed", detail: "fresh workspace seed requires a file mode between 0 and 0777" })] };
  return { status: "ok", value: { files: [{ path: source.file, bytes: encode({ text: source.content }), mode }], preparation: { kind: "workspace-seed", paths: [source.file], inputs: [{ path: source.origin.path, sha256: source.sha256 }] } } };
};
