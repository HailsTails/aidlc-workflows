import { accept } from "../../kernel/fixtures/accept.ts";
import { admitOnboardingSource, type AuthoredOnboardingSource } from "../domain/onboarding-source.ts";

export const onboardingSourceFixture = (source: AuthoredOnboardingSource) => accept(admitOnboardingSource(source));
