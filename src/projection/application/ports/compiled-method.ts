import type { HostIdentity } from "../../../kernel/host.ts";
import type { ProjectPath } from "../../../kernel/values.ts";
import type { Method } from "../../../workflow-definition/domain/method.ts";

export type CompiledMethodRequest = {
  readonly method: Method;
  readonly host: HostIdentity;
  readonly memoryRoot: ProjectPath;
};
