import type { Outcome } from "../domain/model.ts";

export const collectProjectionOutcomes = <T>({
  outcomes,
}: {
  readonly outcomes: readonly Outcome<T>[];
}): Outcome<readonly T[]> => {
  const invalidOutcomes = outcomes.filter((outcome) => outcome.status === "invalid");
  if (invalidOutcomes.length > 0)
    return { status: "invalid", findings: invalidOutcomes.flatMap((outcome) => outcome.findings) };
  return {
    status: "ok",
    value: Object.freeze(
      outcomes.flatMap((outcome) => (outcome.status === "ok" ? [outcome.value] : [])),
    ),
  };
};
