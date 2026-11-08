import { describe, expect, test } from "bun:test";
import type { Accepted } from "../../kernel/result.ts";
import {
  auditSequence,
  checkoutId,
  intentId,
  intentSlug,
  planFingerprint,
  recordVersion,
  sessionId,
  spaceName,
  unitName,
} from "./identities.ts";

const PLAN_HASH = "sha256:5e312852de6e183521a2719293865370e1e2b196c9dd5286b9389a3896fa22d5";

describe("intentId", () => {
  test("accepts a uuid", () => {
    expect(intentId("0193f6a2-7b4c-7d2e-9f1a-3c5b8e0d4a61")).toEqual<Accepted<string>>({
      ok: true,
      value: "0193f6a2-7b4c-7d2e-9f1a-3c5b8e0d4a61",
    });
  });

  test("accepts a dated record folder name", () => {
    expect(intentId("261108-checkout-flow")).toEqual<Accepted<string>>({
      ok: true,
      value: "261108-checkout-flow",
    });
  });

  test.each([
    { shape: "a leading dot", raw: ".hidden" },
    { shape: "a slash", raw: "intents/checkout" },
    { shape: "a space", raw: "checkout flow" },
    { shape: "an empty id", raw: "" },
  ])("refuses $shape", ({ raw }) => {
    expect(intentId(raw)).toEqual({
      ok: false,
      refusal: { kind: "invalid-execution-identity", identity: "intent", raw },
    });
  });
});

describe("intentSlug", () => {
  test("accepts a kebab-case slug", () => {
    expect(intentSlug("checkout-flow")).toEqual<Accepted<string>>({
      ok: true,
      value: "checkout-flow",
    });
  });

  test.each([
    { shape: "an upper-case letter", raw: "Checkout-flow" },
    { shape: "a leading digit", raw: "261108-checkout-flow" },
    { shape: "an underscore", raw: "checkout_flow" },
  ])("refuses $shape", ({ raw }) => {
    expect(intentSlug(raw)).toEqual({
      ok: false,
      refusal: { kind: "invalid-execution-identity", identity: "intent-slug", raw },
    });
  });
});

describe("spaceName", () => {
  test("accepts a kebab-case space name", () => {
    expect(spaceName("default")).toEqual<Accepted<string>>({ ok: true, value: "default" });
  });

  test("refuses a space name with a dot", () => {
    expect(spaceName("team.payments")).toEqual({
      ok: false,
      refusal: { kind: "invalid-execution-identity", identity: "space", raw: "team.payments" },
    });
  });
});

describe("sessionId", () => {
  test("accepts a host session id", () => {
    expect(sessionId("5c1e9f2a-0b7d-4e3c-8a61-2f9d4b7e0c35")).toEqual<Accepted<string>>({
      ok: true,
      value: "5c1e9f2a-0b7d-4e3c-8a61-2f9d4b7e0c35",
    });
  });

  test("refuses a session id with a slash", () => {
    expect(sessionId("sessions/5c1e9f2a")).toEqual({
      ok: false,
      refusal: {
        kind: "invalid-execution-identity",
        identity: "session",
        raw: "sessions/5c1e9f2a",
      },
    });
  });
});

describe("unitName", () => {
  test("accepts a unit name with dots and underscores", () => {
    expect(unitName("payments_api.v2")).toEqual<Accepted<string>>({
      ok: true,
      value: "payments_api.v2",
    });
  });

  test("refuses a unit name with a leading dash", () => {
    expect(unitName("-payments")).toEqual({
      ok: false,
      refusal: { kind: "invalid-execution-identity", identity: "unit", raw: "-payments" },
    });
  });
});

describe("checkoutId", () => {
  test("accepts a worktree checkout id", () => {
    expect(checkoutId("wt-payments-api")).toEqual<Accepted<string>>({
      ok: true,
      value: "wt-payments-api",
    });
  });

  test("refuses a checkout id with a colon", () => {
    expect(checkoutId("wt:payments")).toEqual({
      ok: false,
      refusal: { kind: "invalid-execution-identity", identity: "checkout", raw: "wt:payments" },
    });
  });
});

describe("planFingerprint", () => {
  test("accepts a sha256 fingerprint", () => {
    expect(planFingerprint(PLAN_HASH)).toEqual<Accepted<string>>({ ok: true, value: PLAN_HASH });
  });

  test.each([
    { shape: "a digest without its algorithm", raw: "5e312852de6e1835" },
    { shape: "a short digest", raw: "sha256:5e312852" },
  ])("refuses $shape", ({ raw }) => {
    expect(planFingerprint(raw)).toEqual({
      ok: false,
      refusal: { kind: "invalid-execution-identity", identity: "plan-fingerprint", raw },
    });
  });
});

describe("recordVersion", () => {
  test("accepts zero", () => {
    expect(recordVersion(0)).toEqual<Accepted<number>>({ ok: true, value: 0 });
  });

  test("accepts a positive whole number", () => {
    expect(recordVersion(42)).toEqual<Accepted<number>>({ ok: true, value: 42 });
  });

  test.each([
    { shape: "a negative number", raw: -1, text: "-1" },
    { shape: "a fraction", raw: 1.5, text: "1.5" },
    { shape: "a number past the safe range", raw: 9007199254740992, text: "9007199254740992" },
    { shape: "not a number", raw: Number.NaN, text: "NaN" },
  ])("refuses $shape and reports it as text", ({ raw, text }) => {
    expect(recordVersion(raw)).toEqual({
      ok: false,
      refusal: { kind: "invalid-execution-identity", identity: "record-version", raw: text },
    });
  });
});

describe("auditSequence", () => {
  test("accepts a whole number", () => {
    expect(auditSequence(7)).toEqual<Accepted<number>>({ ok: true, value: 7 });
  });

  test("refuses a negative number", () => {
    expect(auditSequence(-3)).toEqual({
      ok: false,
      refusal: { kind: "invalid-execution-identity", identity: "audit-sequence", raw: "-3" },
    });
  });
});
