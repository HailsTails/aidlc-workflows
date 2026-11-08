import { describe, expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { CORE_GUARDS, guardId, type GuardDeclaration } from "./guard.ts";
import { guardInventory } from "./guard-inventory.ts";

const coverageThreshold: GuardDeclaration = {
  id: accept(guardId("test-pro/coverage-threshold")),
  protects: "Coverage stays above the team's threshold.",
  lift: { kind: "override-once" },
};

describe("guardInventory", () => {
  test("lists every core guard, then each contributed guard", () => {
    expect(guardInventory([coverageThreshold])).toEqual({
      ok: true,
      value: [
        CORE_GUARDS.planApproval,
        CORE_GUARDS.reviewFreeze,
        CORE_GUARDS.stateTransition,
        CORE_GUARDS.reviewerScope,
        CORE_GUARDS.humanPresence,
        CORE_GUARDS.blockingCheck,
        CORE_GUARDS.forwardingLoop,
        coverageThreshold,
      ],
    });
  });

  test("refuses a contributed guard that reuses a core guard's id", () => {
    expect(guardInventory([{ ...coverageThreshold, id: CORE_GUARDS.planApproval.id }])).toEqual({
      ok: false,
      refusal: { kind: "guard-declared-twice", guard: CORE_GUARDS.planApproval.id },
    });
  });
});
