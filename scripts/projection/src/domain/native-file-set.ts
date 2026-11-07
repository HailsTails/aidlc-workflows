import type { NativeResource } from "./native-rendering.ts";
import { finding, type Outcome } from "./model.ts";

export const collectNativeFiles = ({ resources }: { readonly resources: readonly NativeResource[] }): Outcome<readonly NativeResource[]> => {
  const fragments = resources.filter((resource) => resource.kind !== "file").map((resource) => finding({ code: "capability-gap", subject: resource.path, detail: "native file sets require assembled files; registration fragments must be reconciled by their owner first" }));
  if (fragments.length > 0) return { status: "invalid", findings: fragments };
  const duplicates = resources.filter((resource, index) => resources.findIndex((candidate) => candidate.path === resource.path) !== index).map((resource) => finding({ code: "destination-collision", subject: resource.path, detail: "native file set must emit each destination once" }));
  if (duplicates.length > 0) return { status: "invalid", findings: duplicates };
  return { status: "ok", value: resources };
};
