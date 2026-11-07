export type OnboardingDestination = {
  readonly root: "project" | "harness";
  readonly path: string;
};

export type OnboardingDocument = {
  readonly kind: "neutral" | "combined" | "native";
  readonly destination: OnboardingDestination;
  readonly content: string;
};

// A host with its own setup document leaves shared project guidance neutral.
export function projectOnboardingDocuments({ neutral, nativeSkeleton, shared, nativePath }: {
  readonly neutral: string;
  readonly nativeSkeleton: string;
  readonly shared: OnboardingDestination;
  readonly nativePath: string | null;
}): readonly OnboardingDocument[] {
  if (nativePath) return [
    { kind: "neutral", destination: { ...shared }, content: neutral },
    { kind: "native", destination: { root: "harness", path: nativePath }, content: nativeSkeleton },
  ];
  return [{
    kind: "combined", destination: { ...shared },
    content: `${nativeSkeleton}\n## Shared AI-DLC onboarding\n\n${neutral}`,
  }];
}
