import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { OnboardingFills } from "./neutral-surface.ts";

export const declaredSlots = (skeleton: string): string[] => [...new Set(
  [...skeleton.matchAll(/\{\{SLOT:([a-z_]+)\}\}/g)].flatMap((match) => match[1] === undefined ? [] : [match[1]]),
)];

export function renderOnboarding(skeleton: string, fills: OnboardingFills): Result<string, string> {
  const filled = declaredSlots(skeleton).reduce((current, slotName) => {
    const slotText = fills.slots[slotName] ?? "";
    const loneLine = new RegExp(`^\\{\\{SLOT:${slotName}\\}\\}\\n`, "m");
    return slotText === "" && loneLine.test(current)
      ? current.replace(loneLine, "") : current.split(`{{SLOT:${slotName}}}`).join(slotText);
  }, skeleton);
  const rendered = filled.split("{{SKILL_INVOKE}}").join(fills.invoke);
  const leftover = rendered.match(/\{\{SLOT:[a-z_]+\}\}|\{\{SKILL_INVOKE\}\}/);
  if (leftover) return refused(
    `onboarding render incomplete: marker ${leftover[0]} survived for invoke="${fills.invoke}". ` +
      "Every {{SLOT:...}} the skeleton declares must be fillable.",
  );
  const normalized = rendered.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n");
  return accepted(normalized.replace(/\n*$/, "\n"));
}

export function renderNeutralOnboarding(skeleton: string): Result<string, string> {
  return /\{\{/.test(skeleton) ? refused("neutral onboarding must not contain template markers")
    : renderOnboarding(skeleton, { invoke: "", slots: {} });
}
