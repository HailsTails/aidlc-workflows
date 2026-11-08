import type { Result } from "../../kernel/result.ts";
import type { Contribution } from "../domain/contribution.ts";
import type { MethodContent, PluginSelection } from "../domain/method.ts";
import type { MethodSource, MethodSourceRoot } from "../domain/method-source.ts";
import type { AuthoredBody } from "../domain/outline.ts";
import type { MethodRefusal } from "../domain/refusals.ts";
import type { SavedScope } from "../domain/scope.ts";
import type { StagePin } from "../domain/stage-graph.ts";

export type MethodReading<Value> = Promise<Result<Value, readonly MethodRefusal[]>>;

export type MethodSources = {
  readonly core: MethodContent;
  readonly contributions: readonly Contribution[];
  readonly saved: readonly SavedScope[];
  readonly pins: readonly StagePin[];
  readonly files: readonly MethodSource[];
};

export interface MethodSourceReader {
  readAuthored(): MethodReading<MethodSources>;
  readInstalled(root: MethodSourceRoot): MethodReading<MethodSources>;
}

export interface PluginSelectionSource {
  readSelection(): Promise<PluginSelection>;
}

export interface MarkdownOutliner {
  outline(text: string): AuthoredBody;
}
