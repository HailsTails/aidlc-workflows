import { describe, expect, test } from "vitest";
import {
  parsedWhyChain,
  REQUIRED_WHY_COUNT,
  whyChainProblem,
} from "./rin-harness-why-chain.ts";

const why = ({
  step,
}: {
  readonly step: number;
}): Readonly<Record<string, string>> => ({
  why: `why ${step}`,
  because: `because the matcher at step ${step} could not express the id`,
  evidence: `git show abc123:path/to/file.ts:${step}`,
});

const COMPLETE_CHAIN = {
  whys: [1, 2, 3, 4, 5].map((step) => why({ step })),
  rootCause:
    "the walker's tracker matcher is the retired Spec-Kit pattern, so no issuable id satisfies it",
  owner: "capture 01a0b421-a842-77d5-84dc-282775bac424",
};

describe("a complete chain is accepted", () => {
  test("five answered whys, a root cause, and an owner carry no problem", () => {
    expect(whyChainProblem(COMPLETE_CHAIN)).toBeUndefined();
  });

  test("a complete chain parses to its five whys", () => {
    expect(parsedWhyChain(COMPLETE_CHAIN)?.whys).toHaveLength(
      REQUIRED_WHY_COUNT,
    );
  });

  test("a complete chain parses its owner through unchanged", () => {
    expect(parsedWhyChain(COMPLETE_CHAIN)?.owner).toBe(COMPLETE_CHAIN.owner);
  });
});

describe("a chain that is not five answered whys is refused", () => {
  test.each([
    ["four whys", { ...COMPLETE_CHAIN, whys: COMPLETE_CHAIN.whys.slice(0, 4) }],
    [
      "six whys",
      { ...COMPLETE_CHAIN, whys: [...COMPLETE_CHAIN.whys, why({ step: 6 })] },
    ],
    ["no whys", { ...COMPLETE_CHAIN, whys: [] }],
    ["whys is not an array", { ...COMPLETE_CHAIN, whys: "five of them" }],
  ])("%s is refused", (_label, chain) => {
    expect(whyChainProblem(chain)).toBeDefined();
  });

  test("the refusal names the count it found", () => {
    expect(
      whyChainProblem({
        ...COMPLETE_CHAIN,
        whys: COMPLETE_CHAIN.whys.slice(0, 3),
      }),
    ).toContain("found 3");
  });
});

describe("a why missing its answer or its evidence is refused", () => {
  const chainWithBrokenStep = ({
    field,
  }: {
    readonly field: string;
  }): Readonly<Record<string, unknown>> => ({
    ...COMPLETE_CHAIN,
    whys: COMPLETE_CHAIN.whys.map((step, index) =>
      index === 2 ? { ...step, [field]: "" } : step,
    ),
  });

  test.each([
    ["because"],
    ["evidence"],
    ["why"],
  ])("a why with an empty `%s` is refused", (field) => {
    expect(whyChainProblem(chainWithBrokenStep({ field }))).toBeDefined();
  });

  test("the refusal names which why broke", () => {
    expect(
      whyChainProblem(chainWithBrokenStep({ field: "evidence" })),
    ).toContain("why 3");
  });
});

describe("this door's substance floor is its own, pinned at its boundary", () => {
  const chainWithAnswerOf = (
    length: number,
  ): Readonly<Record<string, unknown>> => ({
    ...COMPLETE_CHAIN,
    whys: COMPLETE_CHAIN.whys.map((step) => ({
      ...step,
      because: "x".repeat(length),
    })),
  });

  test.each([[10], [11]])("an answer of %i characters is refused", (length) => {
    expect(whyChainProblem(chainWithAnswerOf(length))).toBeDefined();
  });

  test.each([
    [12],
    [13],
  ])("a repeated-character answer of %i characters is refused", (length) => {
    expect(whyChainProblem(chainWithAnswerOf(length))).toBeDefined();
  });

  test("a 12-character distinct answer meets the structural floor", () => {
    const chain = {
      ...COMPLETE_CHAIN,
      whys: COMPLETE_CHAIN.whys.map((step) => ({
        ...step,
        because: "cause found1",
      })),
    };
    expect(whyChainProblem(chain)).toBeUndefined();
  });
});

test("a repeated-character evidence citation is refused", () => {
  const chain = {
    ...COMPLETE_CHAIN,
    whys: COMPLETE_CHAIN.whys.map((step) => ({
      ...step,
      evidence: "b".repeat(12),
    })),
  };
  expect(whyChainProblem(chain)).toBeDefined();
});

test.each([
  { rootCause: "x", owner: COMPLETE_CHAIN.owner },
  { rootCause: COMPLETE_CHAIN.rootCause, owner: "y" },
])("a placeholder terminus is refused", (terminus) => {
  expect(whyChainProblem({ ...COMPLETE_CHAIN, ...terminus })).toBeDefined();
});

describe("a root cause that restates the exception is refused", () => {
  test.each([
    ["the gate was failing", "the gate was failing"],
    ["CI red", "CI was red"],
    ["no time", "no time before the gate closed"],
    ["out of scope", "out of scope for this record"],
    ["existing convention", "existing convention in this package"],
    ["a deadline", "deadline pressure on the lane"],
  ])("a root cause of %s is refused", (_label, rootCause) => {
    expect(whyChainProblem({ ...COMPLETE_CHAIN, rootCause })).toBeDefined();
  });

  test("the refusal quotes the symptom it rejected", () => {
    expect(
      whyChainProblem({ ...COMPLETE_CHAIN, rootCause: "the gate was failing" }),
    ).toContain("the gate was failing");
  });

  test.each([
    [
      "a walker gap",
      "the CD-5 walker's matcher is the retired Spec-Kit pattern, so no issuable AIDLC id satisfies it",
    ],
    [
      "an upstream contract",
      "node:crypto's ScryptOptions names its members N, r, p — Node's public API, which biome's naming rule cannot express",
    ],
    [
      "a lock gap",
      "IF-1 freezes __brand verbatim across 8 declarations while the naming rule allows only camelCase",
    ],
  ])("a genuine cause naming %s is accepted", (_label, rootCause) => {
    expect(whyChainProblem({ ...COMPLETE_CHAIN, rootCause })).toBeUndefined();
  });

  test.each([
    [
      "prior convention",
      "the matcher outlived its naming scheme, an existing convention nobody revisited when the rule landed",
    ],
    [
      "a deadline",
      "the port was introduced under a deadline that has since passed, and the temporary shape was never revisited",
    ],
    [
      "scope",
      "the walker predates the rule and was left out of scope by the migration that introduced it",
    ],
    [
      "a failing gate",
      "the fixture shares a module-level cache, so the second case reads the first's state and the test was failing only in suite order",
    ],
  ])("a causal root cause that merely mentions %s is accepted", (_label, rootCause) => {
    expect(whyChainProblem({ ...COMPLETE_CHAIN, rootCause })).toBeUndefined();
  });

  test.each([
    ["the gate was failing", "Because the gate was failing"],
    ["existing code", "because the existing code does it this way"],
    ["no time", "because there was no time"],
    ["out of scope", "because it is out of scope for this record"],
  ])("the rule's own verbatim form %s is refused", (_label, rootCause) => {
    expect(whyChainProblem({ ...COMPLETE_CHAIN, rootCause })).toBeDefined();
  });

  test.each([
    ["we ran out of time", "We ran out of time."],
    ["we had no time", "we had no time"],
    ["it was out of scope", "it was out of scope"],
    ["because of a deadline", "because of a deadline"],
  ])("a capacity terminus phrased as %s is refused", (_label, rootCause) => {
    expect(whyChainProblem({ ...COMPLETE_CHAIN, rootCause })).toBeDefined();
  });
});

describe("a chain missing its terminus is refused", () => {
  test.each([
    [
      "no root cause",
      { whys: COMPLETE_CHAIN.whys, owner: COMPLETE_CHAIN.owner },
    ],
    [
      "no owner",
      { whys: COMPLETE_CHAIN.whys, rootCause: COMPLETE_CHAIN.rootCause },
    ],
    ["an empty root cause", { ...COMPLETE_CHAIN, rootCause: "   " }],
    ["an empty owner", { ...COMPLETE_CHAIN, owner: "" }],
  ])("%s is refused", (_label, chain) => {
    expect(whyChainProblem(chain)).toBeDefined();
  });
});

describe("a non-chain is refused rather than read as absent", () => {
  test.each([
    ["undefined", undefined],
    ["null", null],
    ["a string", "five whys, honest"],
    ["an array", [1, 2, 3, 4, 5]],
  ])("%s is refused", (_label, candidate) => {
    expect(whyChainProblem(candidate)).toBeDefined();
  });

  test("a refused candidate does not parse", () => {
    expect(parsedWhyChain("five whys, honest")).toBeUndefined();
  });
});
