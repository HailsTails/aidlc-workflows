import type { ProjectionSet } from "./projection-set.ts";
import { finding, type Outcome } from "../domain/model.ts";

export const formatProjectionSet = ({ projection, showFile }: { readonly projection: ProjectionSet; readonly showFile: string | null }): Outcome<string> => {
  if (showFile !== null) {
    const selected = projection.resources.find((resource) => resource.path === showFile);
    return selected === undefined ? { status: "invalid", findings: [finding({ code: "invalid-destination", subject: showFile, detail: "requested file is not in the selected projection set; inspect the inventory first" })] } : { status: "ok", value: selected.body };
  }
  const discoveries = projection.units.flatMap((unit) => unit.kind === "skill" ? [unit.projection.discovery] : unit.kind === "runners" ? unit.projection.runners.map((runner) => runner.discovery) : []);
  const configured = [...new Set(discoveries.flatMap((discovery) => discovery.kind === "configured-directory" ? [`Discovery: ${discovery.config} must include ${discovery.root}`] : []))];
  return { status: "ok", value: [`Selected-surface projection: ${projection.target.harness}`, `${projection.units.length} units; ${projection.resources.length} files`, ...projection.resources.map((resource) => resource.path), ...configured, "Scope: selected files only; installation and runtime activation are not planned.", ""].join("\n") };
};
