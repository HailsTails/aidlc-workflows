import { describe, expect, it } from "vitest";
import { whyChainSchema } from "./why-chain.ts";

const WHY = {
  why: "why is the exception taken",
  because: "the matcher cannot express the tracker id",
  evidence: "tools/why-chain-check.ts:9",
};

const ROOT_CAUSE = "the audit's matcher predates the tracker id format";

const CHAIN = {
  whys: [WHY, WHY, WHY, WHY, WHY],
  rootCause: ROOT_CAUSE,
  owner: "capture 01a0b421",
};

describe("whyChainSchema accepts a complete chain", () => {
  it("accepts five substantive whys, a root cause and an owner", () => {
    expect(whyChainSchema.safeParse(CHAIN).success).toBe(true);
  });

  it("parses the chain to the same values", () => {
    expect(whyChainSchema.parse(CHAIN)).toEqual(CHAIN);
  });

  it("accepts a because of exactly twelve characters", () => {
    expect(
      whyChainSchema.safeParse({
        ...CHAIN,
        whys: [WHY, WHY, { ...WHY, because: "twelve chars" }, WHY, WHY],
      }).success,
    ).toBe(true);
  });

  it("accepts an evidence of exactly twelve characters", () => {
    expect(
      whyChainSchema.safeParse({
        ...CHAIN,
        whys: [WHY, WHY, { ...WHY, evidence: "twelve chars" }, WHY, WHY],
      }).success,
    ).toBe(true);
  });

  it("accepts an owner of exactly two characters", () => {
    expect(whyChainSchema.safeParse({ ...CHAIN, owner: "HG" }).success).toBe(
      true,
    );
  });

  it.each([
    "the gateway config omits the tracker id",
    "the testing harness never loaded the hook",
    "deadlines are stored as text in the tracker",
    "existing records carry no tracker id field",
    "no timeline was set for the migration",
    "the matcher outlived its naming scheme, an existing convention nobody revisited when the rule landed",
    "the port was introduced under a deadline that has since passed, and the temporary shape was never revisited",
    "the audit predates the rule and was left out of scope by the migration that introduced it",
    "the fixture shares a module-level cache, so the second case reads the first's state and the test was failing only in suite order",
  ])("accepts the root cause %j, which only resembles a restatement", (rootCause) => {
    expect(whyChainSchema.safeParse({ ...CHAIN, rootCause }).success).toBe(true);
  });
});

describe("whyChainSchema refuses a chain that is not exactly five whys", () => {
  it.each([
    ["no whys", { ...CHAIN, whys: [] }],
    ["four whys", { ...CHAIN, whys: [WHY, WHY, WHY, WHY] }],
    ["six whys", { ...CHAIN, whys: [WHY, WHY, WHY, WHY, WHY, WHY] }],
    ["whys that are not a list", { ...CHAIN, whys: "five of them" }],
  ])("refuses %s", (_label, chain) => {
    expect(whyChainSchema.safeParse(chain).success).toBe(false);
  });
});

describe("whyChainSchema refuses an answer that is not substantive", () => {
  it.each([
    ["a because of eleven characters", { ...WHY, because: "eleven char" }],
    ["a because of one repeated character", { ...WHY, because: "aaaaaaaaaaaaaaaa" }],
    ["an empty because", { ...WHY, because: "" }],
    ["an evidence of eleven characters", { ...WHY, evidence: "eleven char" }],
    ["an evidence of one repeated character", { ...WHY, evidence: "xxxxxxxxxxxxxxxx" }],
    ["an empty evidence", { ...WHY, evidence: "" }],
    ["a because of eleven characters padded with spaces", { ...WHY, because: "   eleven char   " }],
    ["a because of one repeated character padded with spaces", { ...WHY, because: "  aaaaaaaaaaaaaaaa  " }],
    ["an evidence of eleven characters padded with spaces", { ...WHY, evidence: "   eleven char   " }],
    ["an empty why", { ...WHY, why: "" }],
    ["a why of only spaces", { ...WHY, why: "   " }],
  ])("refuses %s", (_label, why) => {
    expect(
      whyChainSchema.safeParse({ ...CHAIN, whys: [WHY, WHY, why, WHY, WHY] })
        .success,
    ).toBe(false);
  });

  it.each([
    ["a root cause of eleven characters", "eleven char"],
    ["a root cause of one repeated character", "zzzzzzzzzzzzzzzz"],
    ["an empty root cause", ""],
    ["a root cause of only spaces", "   "],
    ["a root cause of eleven characters padded with spaces", "   eleven char   "],
  ])("refuses %s", (_label, rootCause) => {
    expect(whyChainSchema.safeParse({ ...CHAIN, rootCause }).success).toBe(false);
  });

  it.each([
    ["an owner of one character", "H"],
    ["an empty owner", ""],
    ["an owner of one character padded with spaces", "  H  "],
  ])("refuses %s", (_label, owner) => {
    expect(whyChainSchema.safeParse({ ...CHAIN, owner }).success).toBe(false);
  });
});

describe("whyChainSchema refuses a chain missing a part", () => {
  it.each([
    ["no root cause", { whys: CHAIN.whys, owner: CHAIN.owner }],
    ["no owner", { whys: CHAIN.whys, rootCause: CHAIN.rootCause }],
    ["no whys", { rootCause: CHAIN.rootCause, owner: CHAIN.owner }],
    ["a why with no because", { ...CHAIN, whys: [WHY, WHY, { why: WHY.why, evidence: WHY.evidence }, WHY, WHY] }],
    ["a why with no why question", { ...CHAIN, whys: [WHY, WHY, { because: WHY.because, evidence: WHY.evidence }, WHY, WHY] }],
    ["a why with no evidence", { ...CHAIN, whys: [WHY, WHY, { why: WHY.why, because: WHY.because }, WHY, WHY] }],
    ["a value that is not an object", "five whys"],
    ["undefined", undefined],
    ["null", null],
    ["a list", [1, 2, 3, 4, 5]],
  ])("refuses %s", (_label, chain) => {
    expect(whyChainSchema.safeParse(chain).success).toBe(false);
  });
});

describe("whyChainSchema refuses a root cause that restates the exception", () => {
  it.each([
    "the gate was failing on every push",
    "the check were red on every push",
    "the ci is broken on every push",
    "the build are failing on every push",
    "the lint was red on every push",
    "the test is broken on every push",
    "the gate were broken on every push",
    "the check are red on every push",
    "there was no time to pay it down",
    "no time to pay the debt down",
    "we had no time to pay it down",
    "we ran out of time on this record",
    "it is out of scope for this record",
    "it was out of scope for this record",
    "out of scope for this record",
    "the existing code does it this way",
    "the existing convention does it this way",
    "the existing pattern does it this way",
    "an existing code path does it this way",
    "an existing convention does it this way",
    "an existing pattern does it this way",
    "a time constraint on this record",
    "the time constraint on this record",
    "a deadline on this record",
    "the deadline on this record",
  ])("refuses %j", (rootCause) => {
    expect(whyChainSchema.safeParse({ ...CHAIN, rootCause }).success).toBe(false);
  });

  it.each([
    "because the gate was failing on every push",
    "because there was no time to pay it down",
    "because no time was left for the debt",
    "because we had no time to pay it down",
    "because we ran out of time on this record",
    "because it was out of scope for this record",
    "because out of scope work was deferred",
    "because the existing code does it this way",
    "because an existing pattern does it this way",
    "because the time constraint on this record",
    "because a deadline on this record",
  ])("refuses %j, led by because", (rootCause) => {
    expect(whyChainSchema.safeParse({ ...CHAIN, rootCause }).success).toBe(false);
  });

  it.each([
    "Because of The Gate Was Failing on every push",
    "BECAUSE OF THERE WAS NO TIME TO PAY IT DOWN",
    "Because of no time left for the debt",
    "because of We Had No Time to pay it down",
    "Because Of we ran out of time on this record",
    "because of It Is Out Of Scope for this record",
    "BECAUSE OF OUT OF SCOPE WORK ON THIS RECORD",
    "Because of the Existing Convention here",
    "because of AN EXISTING CODE path here",
    "Because of A Time Constraint on this record",
    "BECAUSE OF THE DEADLINE ON THIS RECORD",
  ])("refuses %j, led by because of in any case", (rootCause) => {
    expect(whyChainSchema.safeParse({ ...CHAIN, rootCause }).success).toBe(false);
  });

  it.each([
    "THE CI WAS RED ON EVERY PUSH",
    "Out Of Scope for this record",
    "The Deadline on this record",
  ])("refuses %j in any case with no leading because", (rootCause) => {
    expect(whyChainSchema.safeParse({ ...CHAIN, rootCause }).success).toBe(false);
  });

  it.each([
    "gate was failing on every push",
    "ci was red on every push",
    "the tests were failing on every push",
    "checks are red on every push",
    "the builds were broken on main",
    "CI was red on every push",
    "there was no time",
    "no time before the gate closed",
    "We ran out of time.",
    "it was out of scope",
    "it is the existing code path here",
    "it was an existing pattern here",
    "it is existing code in this package",
    "existing convention in this package",
    "a existing pattern in this package",
    "time constraint on this record",
    "deadline pressure on the lane",
    "because of a deadline",
    "Because the gate was failing",
    "because the existing code does it this way",
    "   the gate was failing on every push",
  ])("refuses %j, as R7's validator does", (rootCause) => {
    expect(whyChainSchema.safeParse({ ...CHAIN, rootCause }).success).toBe(false);
  });
});
