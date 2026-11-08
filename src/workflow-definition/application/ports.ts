import type { Result } from "../../kernel/result.ts";
import type { Contribution } from "../domain/contribution.ts";
import type { MethodContent, PluginSelection } from "../domain/method.ts";
import type { MethodRefusal } from "../domain/refusals.ts";

export type MethodReading<Value> = Promise<Result<Value, readonly MethodRefusal[]>>;

export interface AuthoredSourceReader {
  readCore(): MethodReading<MethodContent>;
}

export interface ContributionSource {
  readContributions(): MethodReading<readonly Contribution[]>;
}

export interface PluginSelectionSource {
  readSelection(): Promise<PluginSelection>;
}
