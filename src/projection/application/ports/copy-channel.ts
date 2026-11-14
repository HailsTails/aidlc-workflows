import type { Result } from "../../../kernel/result.ts";
import type { ProjectionRefusal } from "../../domain/projection.ts";

export type CopyChannelAllows = {
  readonly dispatcherCommands: readonly string[];
  readonly toolScripts: readonly string[];
};

export interface CopyChannelAllowSource {
  read(): Result<CopyChannelAllows, ProjectionRefusal>;
}
