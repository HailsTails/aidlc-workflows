import { describe, expect, it } from "vitest";
import type { Result } from "./result.ts";
import type { Equal } from "./type-equality.ts";

describe("Result", () => {
  it("is exactly the ok-or-failed union", () => {
    const lockedShape: Equal<
      Result<number, string>,
      | { readonly outcome: "ok"; readonly value: number }
      | { readonly outcome: "failed"; readonly error: string }
    > = true;
    expect(lockedShape).toBe(true);
  });

  it("carries a failure as data under the failed outcome", () => {
    const failure: Result<number, { readonly kind: "unreadable" }> = {
      outcome: "failed",
      error: { kind: "unreadable" },
    };
    expect(failure).toEqual({ outcome: "failed", error: { kind: "unreadable" } });
  });
});
