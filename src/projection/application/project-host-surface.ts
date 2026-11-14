import { refused } from "../../kernel/result.ts";
import type { DelegateShellFacts } from "./ports/delegate-shell.ts";
import type { HostSurfaceProjection } from "./ports/host-surface.ts";
import type { Rendering } from "./ports/harness.ts";
import { collectCommandRenderings } from "./command-renderers.ts";
import { createHostSurfaceMembers } from "./host-surface-members.ts";

export const createHostSurfaceProjection = (
  delegateShellFacts: DelegateShellFacts,
): HostSurfaceProjection => (request) => {
  const hostData = request.renderData({ delegateShellFacts });
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
