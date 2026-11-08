import type { Result } from "../../kernel/result.ts";
import type { Contribution } from "../domain/contribution.ts";
import type { Method, MethodContent, PluginSelection } from "../domain/method.ts";
import type { MethodRefusal } from "../domain/refusals.ts";

export type CompileMethodRequest = {
  readonly core: MethodContent;
  readonly contributions: readonly Contribution[];
  readonly selection: PluginSelection;
};

export interface CompileMethod {
  compile(request: CompileMethodRequest): Result<Method, readonly MethodRefusal[]>;
}

export interface LoadMethod {
  load(): Promise<Result<Method, readonly MethodRefusal[]>>;
}
