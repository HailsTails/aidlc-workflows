import { describe, expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { CORE_GUARDS, guardId, type GuardDeclaration } from "./guard.ts";
import { composeGuards } from "./guard-inventory.ts";
import { reviewReceiptRule } from "./guard-rules.ts";
import {
  forwardingLoopRule,
  NO_HOST_RULES,
  reviewFreezeRule,
  type HostGuardRule,
  type HostGuardRules,
} from "./host-guard-rules.ts";

const coverageThreshold: GuardDeclaration = {
  id: accept(guardId("test-pro/coverage-threshold")),
  protects: "Coverage stays above the team's threshold.",
  lift: { kind: "override-once" },
};

const coverageAtStop: HostGuardRule<"stop"> = {
  declaration: coverageThreshold,
  check: () => null,
};

const contributed: HostGuardRules = { ...NO_HOST_RULES, stop: [coverageAtStop] };

describe("composeGuards", () => {
  test("lists every core guard, then each contributed guard", () => {
    expect(composeGuards(contributed)).toMatchObject({
      ok: true,
      value: {
        inventory: [
          CORE_GUARDS.planApproval,
          CORE_GUARDS.reviewFreeze,
          CORE_GUARDS.stateTransition,
          CORE_GUARDS.reviewerScope,
          CORE_GUARDS.humanPresence,
          CORE_GUARDS.blockingCheck,
          CORE_GUARDS.forwardingLoop,
          reviewReceiptRule.declaration,
          coverageThreshold,
        ],
      },
    });
  });

  test("runs a contributed check at its host point after the core checks there", () => {
    expect(composeGuards(contributed)).toMatchObject({
      ok: true,
      value: {
        host: { "before-tool": [reviewFreezeRule], stop: [forwardingLoopRule, coverageAtStop] },
      },
    });
  });

  test("refuses a contributed guard that reuses a core guard's id", () => {
    expect(
      composeGuards({
        ...NO_HOST_RULES,
        stop: [{ ...coverageAtStop, declaration: { ...coverageThreshold, id: CORE_GUARDS.planApproval.id } }],
      }),
    ).toEqual({
      ok: false,
      refusal: { kind: "guard-declared-twice", guard: CORE_GUARDS.planApproval.id },
    });
  });
});
