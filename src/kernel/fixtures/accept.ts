import type { Result } from "../result.ts";

export const accept = <Value, Refusal>(result: Result<Value, Refusal>): Value => {
  if (result.ok) {
    return result.value;
  }
  throw new Error(`Fixture value refused: ${JSON.stringify(result.refusal)}`);
};
