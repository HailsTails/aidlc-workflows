import { describe, expect, it } from "vitest";
import { causalProblemsOf, legacyWhyChainSchema, whyChainFormOf, whyChainSchema } from "../core/values/why-chain.ts";
import { CAUSAL_WHY_CHAIN, LEGACY_WHY_CHAIN } from "./causal-why-chain.ts";

describe("CAUSAL_WHY_CHAIN is a chain the causal contract accepts", () => {
  it("reads as causal", () => {
    expect(whyChainFormOf({ chain: CAUSAL_WHY_CHAIN })).toBe("causal");
  });

  it("passes the schema unchanged", () => {
    expect(whyChainSchema.safeParse(CAUSAL_WHY_CHAIN)).toEqual({ success: true, data: CAUSAL_WHY_CHAIN });
  });

  it("raises no causal problem", () => {
    expect(causalProblemsOf({ chain: CAUSAL_WHY_CHAIN })).toEqual([]);
  });
});

describe("LEGACY_WHY_CHAIN is a chain written to the earlier contract", () => {
  it("reads as legacy", () => {
    expect(whyChainFormOf({ chain: LEGACY_WHY_CHAIN })).toBe("legacy");
  });

  it("passes the earlier floor unchanged", () => {
    expect(legacyWhyChainSchema.safeParse(LEGACY_WHY_CHAIN)).toEqual({ success: true, data: LEGACY_WHY_CHAIN });
  });
});
