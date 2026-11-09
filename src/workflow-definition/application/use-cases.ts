import type { Result } from "../../kernel/result.ts";
import type { Contribution } from "../domain/contribution.ts";
import type { Method, CoreContent, PluginSelection } from "../domain/method.ts";
import type { MethodRefusal } from "../domain/refusals.ts";
import type { SavedScope } from "../domain/scope.ts";
import type { StagePin } from "../domain/stage-graph.ts";

export type CompileMethodRequest = {
  readonly core: CoreContent;
  readonly contributions: readonly Contribution[];
  readonly saved: readonly SavedScope[];
  readonly pins: readonly StagePin[];
  readonly selection: PluginSelection;
};

export interface CompileMethod {
  compile(request: CompileMethodRequest): Result<Method, readonly MethodRefusal[]>;
}

export interface LoadMethod {
  loadAuthored(): Promise<Result<Method, readonly MethodRefusal[]>>;
}
