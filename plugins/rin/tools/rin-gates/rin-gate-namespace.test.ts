import { describe, expect, expectTypeOf, test } from "vitest";
import type { BoardVerdictToken as EngineReceiptVerdictToken } from "../../hooks/rin-gates-engine-receipt.ts";
import {
  BOARD_VERDICT_TOKENS,
  type BoardVerdictToken,
  GATE_PHASES,
  gateDirSegments,
  isGateSlug,
  phaseOfGate,
  REVIEW_VERDICT_FILENAME,
  reviewVerdictSegments,
} from "./rin-gate-namespace.ts";

describe("phaseOfGate — total over the closed gate vocabulary", () => {
  test("maps rin-gate-0-reconcile to inception", () => {
    expect(phaseOfGate("rin-gate-0-reconcile")).toBe("inception");
  });

  test("maps rin-gate-1-framing to inception", () => {
    expect(phaseOfGate("rin-gate-1-framing")).toBe("inception");
  });

  test("maps rin-gate-2-plan-review to inception", () => {
    expect(phaseOfGate("rin-gate-2-plan-review")).toBe("inception");
  });

  test("maps rin-gate-3-interface-lock to inception", () => {
    expect(phaseOfGate("rin-gate-3-interface-lock")).toBe("inception");
  });

  test("maps rin-gate-4-implement to construction", () => {
    expect(phaseOfGate("rin-gate-4-implement")).toBe("construction");
  });

  test("maps rin-gate-5-review-cycle to construction", () => {
    expect(phaseOfGate("rin-gate-5-review-cycle")).toBe("construction");
  });

  test("maps rin-gate-6-operate to operation", () => {
    expect(phaseOfGate("rin-gate-6-operate")).toBe("operation");
  });
});

describe("phaseOfGate — rejects everything outside the vocabulary", () => {
  test("rejects the retired bare gate slug", () => {
    expect(phaseOfGate("gate-4-implement")).toBeNull();
  });

  test("rejects a well-formed prefix with an unknown gate number", () => {
    expect(phaseOfGate("rin-gate-9-nonexistent")).toBeNull();
  });

  test("rejects a multi-digit gate number that a prefix match would accept", () => {
    expect(phaseOfGate("rin-gate-42-implement")).toBeNull();
  });

  test("rejects a known slug carrying a trailing segment", () => {
    expect(phaseOfGate("rin-gate-4-implement-extra")).toBeNull();
  });

  test("rejects a non-gate string", () => {
    expect(phaseOfGate("not-a-gate")).toBeNull();
  });

  test("rejects the empty string", () => {
    expect(phaseOfGate("")).toBeNull();
  });

  test("rejects an inherited Object.prototype key", () => {
    expect(phaseOfGate("toString")).toBeNull();
  });
});

describe("isGateSlug", () => {
  test("accepts a member of the vocabulary", () => {
    expect(isGateSlug("rin-gate-6-operate")).toBe(true);
  });

  test("rejects a non-member", () => {
    expect(isGateSlug("rin-gate-7-archive")).toBe(false);
  });
});

describe("gateDirSegments", () => {
  test("returns the phase and gate segments for a known gate", () => {
    expect(gateDirSegments("rin-gate-4-implement")).toEqual([
      "construction",
      "rin-gate-4-implement",
    ]);
  });

  test("returns null for an unknown gate", () => {
    expect(gateDirSegments("rin-gate-9-nonexistent")).toBeNull();
  });
});

describe("reviewVerdictSegments", () => {
  test("appends the verdict filename to the gate directory segments", () => {
    expect(reviewVerdictSegments("rin-gate-0-reconcile")).toEqual([
      "inception",
      "rin-gate-0-reconcile",
      REVIEW_VERDICT_FILENAME,
    ]);
  });

  test("returns null for an unknown gate", () => {
    expect(reviewVerdictSegments("not-a-gate")).toBeNull();
  });
});

describe("BOARD_VERDICT_TOKENS — the board verdict vocabulary", () => {
  test("is exactly READY and NOT-READY", () => {
    expect(BOARD_VERDICT_TOKENS).toEqual(["READY", "NOT-READY"]);
  });

  test("names the same tokens as the engine receipt's verdict", () => {
    expectTypeOf<BoardVerdictToken>().toEqualTypeOf<EngineReceiptVerdictToken>();
  });
});

describe("GATE_PHASES — the vocabulary itself", () => {
  test("covers exactly the seven rin-gates stages", () => {
    expect(Object.keys(GATE_PHASES)).toEqual([
      "rin-gate-0-reconcile",
      "rin-gate-1-framing",
      "rin-gate-2-plan-review",
      "rin-gate-3-interface-lock",
      "rin-gate-4-implement",
      "rin-gate-5-review-cycle",
      "rin-gate-6-operate",
    ]);
  });
});
