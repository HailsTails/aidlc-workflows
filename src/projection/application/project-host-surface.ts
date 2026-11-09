import { refused } from "../../kernel/result.ts";
import type { HostSurfaceProjection, Rendering } from "./ports.ts";
import { collectCommandRenderings } from "./command-renderers.ts";
import { createHostSurfaceMembers } from "./host-surface-members.ts";

export const projectHostSurface: HostSurfaceProjection = (request) => {
  const members = createHostSurfaceMembers(request);
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