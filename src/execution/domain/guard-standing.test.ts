import { describe, expect, test } from "bun:test";
import { at } from "../../kernel/fixtures/values.fixture.ts";
import { CORE_GUARDS, type GuardRefusal, type GuardSwitch } from "./guard.ts";
import { enforce, standingOf, type GuardContext } from "./guard-standing.ts";

const switchedOff: GuardSwitch = {
  guard: CORE_GUARDS.stateTransition.id,
  state: "off",
  personWords: "turn the stage order check off for this one",
  at: at("2026-11-08T10:00:00Z"),
};

const switchedBackOn: GuardSwitch = {
  ...switchedOff,
  state: "on",
  personWords: "put it back on",
  at: at("2026-11-08T10:30:00Z"),
};

const strict: GuardContext = {
  policy: "strict",
  lock: { kind: "unlocked" },
  switches: [],
  machineLowered: [],
};

const outOfOrder: GuardRefusal = {
  guard: CORE_GUARDS.stateTransition,
  reason: "application-design is pending; that step needs it in-progress or revising.",
  nextStep: "Ask the engine for the next step and carry that out.",
};

describe("standingOf under policy", () => {
  test.each([
    { policy: "strict", guard: CORE_GUARDS.planApproval, standing: "standing" },
    { policy: "relaxed", guard: CORE_GUARDS.planApproval, standing: "stood-aside" },
    { policy: "relaxed", guard: CORE_GUARDS.stateTransition, standing: "standing" },
    { policy: "off", guard: CORE_GUARDS.stateTransition, standing: "stood-aside" },
    { policy: "off", guard: CORE_GUARDS.reviewerScope, standing: "stood-aside" },
    { policy: "off", guard: CORE_GUARDS.humanPresence, standing: "standing" },
    { policy: "off", guard: CORE_GUARDS.forwardingLoop, standing: "standing" },
  ] as const)("$guard.id under $policy is $standing", ({ policy, guard, standing }) => {
    expect(standingOf(guard, { ...strict, policy }).kind).toBe(standing);
  });
});

describe("standingOf with the person's switches", () => {
  test("a guard the person switched off stands aside and keeps their words", () => {
    expect(standingOf(CORE_GUARDS.stateTransition, { ...strict, switches: [switchedOff] })).toEqual({
      kind: "stood-aside",
      because: { kind: "switched-off", change: switchedOff },
    });
  });

  test("switching it back on outranks a policy that would lower it", () => {
    expect(
      standingOf(CORE_GUARDS.stateTransition, {
        ...strict,
        policy: "off",
        switches: [switchedOff, switchedBackOn],
      }),
    ).toEqual({ kind: "standing" });
  });

  test("a team lock keeps a switchable guard standing whatever was switched", () => {
    expect(
      standingOf(CORE_GUARDS.stateTransition, {
        ...strict,
        lock: { kind: "locked", lockedIn: "aidlc/memory/team.md" },
        switches: [switchedOff],
      }),
    ).toEqual({ kind: "standing" });
  });

  test("the machine switch lowers even human presence", () => {
    expect(
      standingOf(CORE_GUARDS.humanPresence, {
        ...strict,
        machineLowered: [CORE_GUARDS.humanPresence.id],
      }),
    ).toEqual({ kind: "stood-aside", because: { kind: "machine-switch" } });
  });
});

describe("enforce", () => {
  test("a standing guard holds with its refusal", () => {
    expect(enforce(outOfOrder, strict)).toEqual({ kind: "holds", refusal: outOfOrder });
  });

  test("a locked guard's refusal says where the lock is set instead of offering a switch", () => {
    expect(
      enforce(outOfOrder, { ...strict, lock: { kind: "locked", lockedIn: "aidlc/memory/team.md" } }),
    ).toEqual({
      kind: "holds",
      refusal: {
        ...outOfOrder,
        guard: {
          ...CORE_GUARDS.stateTransition,
          lift: { kind: "locked", lockedIn: "aidlc/memory/team.md" },
        },
      },
    });
  });

  test("a lowered guard stands aside and says why", () => {
    expect(enforce(outOfOrder, { ...strict, policy: "off" })).toEqual({
      kind: "stands-aside",
      guard: CORE_GUARDS.stateTransition,
      because: { kind: "policy", policy: "off" },
    });
  });
});
