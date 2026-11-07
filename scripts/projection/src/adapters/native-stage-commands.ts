import { createNativeDocumentCommandPreparer } from "./native-document-commands.ts";
import type { NativeCompilerProcessOperations } from "./native-compiler-process.ts";
import type { NativeStageCommandPreparer, NativeStageCommandRequest } from "../domain/native-stage-commands.ts";
import { finding, pathStatus, type Outcome } from "../domain/model.ts";
const admitStageRequest = ({ request }: { readonly request: NativeStageCommandRequest }): Outcome<NativeStageCommandRequest> => {
  const prefix = `${request.binding.directory}/aidlc-common/stages/`;
  return request.basis.source.kind !== "core" || request.documents.length === 0 || new Set(request.documents.map((document) => document.path)).size !== request.documents.length || request.documents.some((document) => pathStatus({ path: document.path }) === "unsafe" || !document.path.startsWith(prefix) || !/^(initialization|ideation|inception|construction|operation)\/[a-z][a-z0-9-]*\.md$/.test(document.path.slice(prefix.length)))
    ? { status: "invalid", findings: [finding({ code: "invalid-input", subject: "native-stage-commands", detail: "prepare nonempty unique core stage documents within the selected harness's native phase/slug layout" })] } : { status: "ok", value: request };
};
export const createNativeStageCommandPreparer = (options: { readonly binary?: string; readonly operations?: NativeCompilerProcessOperations } = {}): NativeStageCommandPreparer => {
  const documents = createNativeDocumentCommandPreparer(options);
  return { prepare: (request) => {
    const admitted = admitStageRequest({ request });
    return admitted.status === "invalid" ? admitted : documents.prepare(admitted.value);
  } };
};
