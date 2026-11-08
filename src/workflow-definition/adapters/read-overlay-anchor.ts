import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { OverlayAnchor, PersonaAnchor, StageAnchor } from "../domain/contribution.ts";
import type { MethodSourceLocation } from "../domain/method-source.ts";
import type { MethodRefusal } from "../domain/refusals.ts";

type AnchorReading<Anchor> = Result<Anchor, readonly MethodRefusal[]>;

const anchorFailure = (source: MethodSourceLocation, raw: string):
  AnchorReading<never> => refused([{ kind: "invalid-file", location: {
    kind: "method-source", ...source }, issues: [`Unsupported overlay anchor: ${raw}`] }]);

const commonAnchor = (raw: string): OverlayAnchor | null => {
  if (raw.startsWith("in:")) return { kind: "in-section", section: raw.slice(3) };
  if (raw === "after-preflight" || raw === "end-of-body" || raw === "end-of-steps") {
    return { kind: raw };
  }
  const step = /^(after-step|before-step):(\d+)$/.exec(raw);
  return step ? { kind: step[1] === "after-step" ? "after-step" : "before-step",
    step: Number(step[2]) } : null;
};

export const readStageAnchor = (source: MethodSourceLocation, raw: string):
  AnchorReading<StageAnchor> => {
  const anchor = commonAnchor(raw);
  return anchor && anchor.kind !== "after-preflight" && anchor.kind !== "end-of-body"
    ? accepted(anchor) : anchorFailure(source, raw);
};

export const readPersonaAnchor = (source: MethodSourceLocation, raw: string):
  AnchorReading<PersonaAnchor> => {
  const anchor = commonAnchor(raw);
  return anchor && (anchor.kind === "in-section" || anchor.kind === "after-preflight"
    || anchor.kind === "end-of-body") ? accepted(anchor) : anchorFailure(source, raw);
};
