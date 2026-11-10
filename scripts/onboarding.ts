import type { OnboardingFills } from "../src/projection/domain/neutral-surface.ts";
import {
  renderNeutralOnboarding as renderNeutral,
  renderOnboarding as renderForHost,
} from "../src/projection/domain/onboarding.ts";

export { declaredSlots } from "../src/projection/domain/onboarding.ts";

export function renderOnboarding(skeleton: string, fills: OnboardingFills): string {
  const rendered = renderForHost(skeleton, fills);
  if (!rendered.ok) throw new Error(rendered.refusal);
  return rendered.value;
}

export function renderNeutralOnboarding(skeleton: string): string {
  const rendered = renderNeutral(skeleton);
  if (!rendered.ok) throw new Error(rendered.refusal);
  return rendered.value;
}
