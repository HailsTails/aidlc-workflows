import type { Result } from "../../kernel/result.ts";
import type { Payload } from "../../packaging/domain/payload.ts";
import type { InstallMode, InstallPlan, ReadyInstallPlan } from "../domain/install-plan.ts";
import type { CallingHarness } from "../domain/installed-distribution.ts";
import type { InstallRefusal } from "../domain/refusals.ts";

export type PlanInstallRequest = {
  readonly payload: Payload;
  readonly mode: InstallMode;
};

export interface PlanInstall {
  plan(request: PlanInstallRequest): Promise<Result<InstallPlan, InstallRefusal>>;
}

export interface ApplyInstallPlan {
  apply(plan: ReadyInstallPlan): Promise<Result<ReadyInstallPlan, InstallRefusal>>;
}

export interface ResolveCallingHarness {
  resolve(): Promise<CallingHarness>;
}
