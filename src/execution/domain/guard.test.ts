import { describe, expect, test } from "bun:test";
import type { Accepted } from "../../kernel/result.ts";
import { CORE_GUARDS, guardId, type GuardLift } from "./guard.ts";

type PlainGuard = { readonly id: string; readonly protects: string; readonly lift: GuardLift };

describe("guardId", () => {
  test("accepts a core guard id", () => {
    expect(guardId("plan-approval")).toEqual<Accepted<string>>({
      ok: true,
      value: "plan-approval",
    });
  });

  test("accepts a guard id namespaced by its plugin", () => {
    expect(guardId("test-pro/coverage-threshold")).toEqual<Accepted<string>>({
      ok: true,
      value: "test-pro/coverage-threshold",
    });
  });

  test.each([
    { shape: "an upper-case letter", raw: "Plan-approval" },
    { shape: "an underscore", raw: "plan_approval" },
    { shape: "two namespaces", raw: "test-pro/coverage/threshold" },
    { shape: "a leading slash", raw: "/plan-approval" },
    { shape: "a trailing slash", raw: "test-pro/" },
    { shape: "an empty id", raw: "" },
  ])("refuses $shape", ({ raw }) => {
    expect(guardId(raw)).toEqual({ ok: false, refusal: { kind: "invalid-guard-id", raw } });
  });
});

describe("CORE_GUARDS", () => {
  test("declares the six core guards with what each protects and how it lifts", () => {
    expect(CORE_GUARDS).toEqual<Readonly<Record<string, PlainGuard>>>({
      planApproval: {
        id: "plan-approval",
        protects: "Code generation follows the plan the person approved.",
        lift: { kind: "switch" },
      },
      reviewFreeze: {
        id: "review-freeze",
        protects: "A reviewed artifact stays as it was reviewed.",
        lift: { kind: "switch" },
      },
      stateTransition: {
        id: "state-transition",
        protects: "Stations advance only through the engine.",
        lift: { kind: "switch" },
      },
      reviewerScope: {
        id: "reviewer-scope",
        protects: "A reviewer reads only what it reviews.",
        lift: { kind: "switch" },
      },
      humanPresence: {
        id: "human-presence",
        protects: "A gate hears the person's own words.",
        lift: { kind: "override-once" },
      },
      blockingCheck: {
        id: "blocking-check",
        protects: "A blocking check passes before its gate.",
        lift: { kind: "override-once" },
      },
    });
  });
});
