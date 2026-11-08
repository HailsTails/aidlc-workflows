import { refused } from "../../kernel/result.ts";
import type { MethodRefusal } from "../domain/refusals.ts";
import type { CompileMethodRequest, CompileMethod } from "./use-cases.ts";
import type { MarkdownOutliner } from "./ports.ts";
import { compileAuthoredMethod } from "../domain/compile-authored-method.ts";

const freshRequestIssues = (request: CompileMethodRequest): readonly MethodRefusal[] => [
  ...(request.pins.length > 0 ? [{ kind: "invalid-file" as const,
    location: { kind: "stage-pins" as const }, issues: ["The fresh compiler does not apply installed stage pins."] }]
    : []),
  ...request.saved.map((saved) => ({ kind: "invalid-file" as const,
    location: { kind: "method-source" as const, owner: saved.scope.owner, path: saved.scope.source },
    issues: ["The fresh compiler does not apply saved installed scopes."],
  })),
];


export const createMethodCompiler = (outliner: MarkdownOutliner): CompileMethod => ({
  compile: (request) => {
    const unsupported = freshRequestIssues(request);
    return unsupported.length > 0 ? refused(unsupported)
      : compileAuthoredMethod(request, (text) => outliner.outline(text));
  },
});
