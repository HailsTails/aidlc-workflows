import { refused } from "../../kernel/result.ts";
import type { DelegateShellPolicy, HostSurfaceProjection, Rendering } from "./ports.ts";
import { collectCommandRenderings } from "./command-renderers.ts";
import { createHostSurfaceMembers } from "./host-surface-members.ts";

export const createHostSurfaceProjection = (
  delegateShell: (directory: string) => DelegateShellPolicy,
): HostSurfaceProjection => (request) => {
  const hostData = request.renderData({ delegateShell: delegateShell(request.host.directory) });
  const members = createHostSurfaceMembers({ ...request, data: hostData });
  return collectCommandRenderings([
    members.renderHostData(),
    ...request.placements.map((placement): Rendering => {
      const file = request.files.find((candidate) => candidate.source === placement.source);
      return file ? members.placeAuthoredFile({ file }) : refused({
        kind: "render-failed", concept: "host-data", name: placement.source,
        reason: "The declared authored host file was not captured.",
      });
    }),
  ]);
};
