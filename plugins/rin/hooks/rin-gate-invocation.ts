import { basename, dirname, join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { completionCommands, type ObservedReportCommand, type ReportCommandContext } from "../../../core/tools/aidlc-report-command.ts";
import type { resolveReportTarget } from "../../../core/tools/aidlc-report-target.ts";

type TargetContract = { resolveReportTarget: typeof resolveReportTarget };

// The installed sibling module is authoritative. The source fallback is a
// relative development layout, never a portable manifest-supplied executable.
function coreModulePath(name: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const installed = resolve(here, "../tools", name);
  if (basename(dirname(here)).startsWith(".")) return installed;
  return resolve(here, "../../../core/tools", name);
}

export function completionOperations(input: { command: string; context: ReportCommandContext }): ObservedReportCommand[] {
  // The projector bundles this static import with the hook. Relevance remains
  // available even when the separately installed target/runtime needs repair.
  return completionCommands(input);
}

export function resolveCompletionTarget(operation: ObservedReportCommand): ReturnType<typeof resolveReportTarget> {
  if (operation.request.kind !== "report") return { kind: "unavailable", reason: operation.request.kind === "invalid" ? operation.request.diagnostic : "Not a report operation" };
  const path = coreModulePath("aidlc-report-target.ts");
  if (!existsSync(path)) return { kind: "unavailable", reason: `Installed completion target contract unavailable at ${path}; refresh the runtime and Rin plugin together.` };
  const contract: TargetContract = require(path);
  const target = contract.resolveReportTarget({ request: operation.request, context: operation.context });
  if (target.kind === "resolved" && typeof target.unjoined !== "boolean") {
    return { kind: "unavailable", reason: "The installed completion target contract is incompatible; refresh the runtime and Rin plugin together." };
  }
  return target;
}

export const isCompletionReport = (input: { readonly command: string }): boolean =>
  completionOperations({ ...input, context: { cwd: process.cwd(), environment: process.env } }).length > 0;

export const gateToolsDirectoryOf = (input: {
  readonly hookDirectory: string;
  readonly checkoutRoot: string;
}): string =>
  basename(dirname(input.hookDirectory)).startsWith(".")
    ? resolve(input.hookDirectory, "..", "tools")
    : join(input.checkoutRoot, ".claude", "tools");

export const gateScopeGridPathOf = (input: {
  readonly hookDirectory: string;
  readonly checkoutRoot: string;
}): string => {
  const host = basename(dirname(input.hookDirectory));
  return join(input.checkoutRoot, host.startsWith(".") ? host : ".claude", "tools", "data", "scope-grid.json");
};
