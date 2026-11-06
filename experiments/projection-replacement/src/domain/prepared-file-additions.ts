import type { NativeResource } from "./native-rendering.ts";
import { collectNativeFiles } from "./native-file-set.ts";
import { finding, type Outcome, type pathStatus } from "./model.ts";
import { planPreparedRuntimeFiles, type PreparedRuntimeInventory, type PreparedFileAdditionPlan } from "./prepared-runtime-files.ts";
export type { PreparedFileAdditionPlan } from "./prepared-runtime-files.ts";
export type PreparedFileAdditionServices = { readonly collect: typeof collectNativeFiles; readonly plan: typeof planPreparedRuntimeFiles };
export const createPreparedFileAdditionServices = (): PreparedFileAdditionServices => ({ collect: collectNativeFiles, plan: planPreparedRuntimeFiles });
export const planPreparedFileAdditions = ({ candidates, inventory, mode, rules, services = createPreparedFileAdditionServices() }: { readonly candidates: readonly NativeResource[]; readonly inventory: PreparedRuntimeInventory; readonly mode: number; readonly rules: { readonly path: typeof pathStatus; readonly encode: (input: { readonly text: string }) => Uint8Array }; readonly services?: PreparedFileAdditionServices }): Outcome<PreparedFileAdditionPlan> => {
  const collected = services.collect({ resources: candidates });
  if (collected.status === "invalid") return collected;
  if (!Number.isInteger(mode) || mode < 0 || mode > 0o777) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "prepared-runner-mode", detail: "new prepared files require a permission mode between 0 and 0777" })] };
  return services.plan({ candidates: collected.value.map((candidate) => ({ path: candidate.path, bytes: rules.encode({ text: candidate.body }), mode })), inventory, rules });
};
