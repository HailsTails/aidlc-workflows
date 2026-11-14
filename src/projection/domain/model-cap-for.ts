import type { Tier } from "../../workflow-definition/domain/vocabulary.ts";
import type { BuildMode, ModelCapReading } from "./model-cap.ts";

export const modelCapFor = ({ mode, environment, memory }: {
  readonly mode: BuildMode;
  readonly environment: { readonly cap: Tier | null; readonly presence: "set" | "unset" };
  readonly memory: Tier | null;
}): ModelCapReading => {
  const selected = mode === "build" ? environment.cap : null;
  return { cap: selected ?? memory, source: selected ? "environment" : memory ? "memory" : null,
    environment: selected ? "applied" : mode === "check" && environment.presence === "set" ? "ignored" : "unset" };
};
