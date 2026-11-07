import type { Outcome } from "../domain/model.ts";
export const continuePreparation = async <Previous, Next>({ previous, consume }: { readonly previous: Outcome<Previous> | Promise<Outcome<Previous>>; readonly consume: (input: { readonly prepared: Previous }) => Outcome<Next> | Promise<Outcome<Next>> }): Promise<Outcome<Next>> => {
  const resolved = await previous;
  return resolved.status === "invalid" ? resolved : consume({ prepared: resolved.value });
};
