import type { Result } from "../result.ts";

export const accept = <Value, Refusal>(construction: Result<Value, Refusal>): Value => {
  if (!construction.ok) {
    throw new Error(`Fixture value refused: ${JSON.stringify(construction.refusal)}`);
  }
  return construction.value;
};
