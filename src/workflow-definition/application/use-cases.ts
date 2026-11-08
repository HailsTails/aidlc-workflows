import type { Result } from "../../kernel/result.ts";
import type { Contribution } from "../domain/contribution.ts";
import type { Method, MethodContent, PluginSelection } from "../domain/method.ts";
import type { MethodSourceRoot } from "../domain/method-source.ts";
import type { MethodRefusal } from "../domain/refusals.ts";
import type { SavedScope } from "../domain/scope.ts";
import type { StagePin } from "../domain/stage-graph.ts";

export type CompileMethodRequest = {
  readonly core: MethodContent;
  readonly contributions: readonly Contribution[];
  readonly saved: readonly SavedScope[];
  readonly pins: readonly StagePin[];
  readonly selection: PluginSelection;
};

export interface CompileMethod {
  compile(request: CompileMethodRequest): Result<Method, readonly MethodRefusal[]>;
}

export type MethodLocation =
  | { readonly kind: "authored" }
  | { readonly kind: "installed"; readonly root: MethodSourceRoot };

export interface LoadMethod {
  load(location: MethodLocation): Promise<Result<Method, readonly MethodRefusal[]>>;
}
