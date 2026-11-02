import { describe, expect, it } from "vitest";
import { causalProblemsOf, type Why, type WhyChain, whyChainFormOf, whyChainSchema } from "./why-chain.ts";
import { CAUSAL_WHY_CHAIN } from "../../tests/causal-why-chain.ts";

const CAUSAL_CHAIN = CAUSAL_WHY_CHAIN;

const OBJECTION_LIST: WhyChain = {
  whys: [
    {
      why: "Why does built-targets.ts import the Node file reader and YAML parser?",
      because: "It implements BuiltTargetSource for the actual admin build, reading config.yml and decoding YAML at one outer boundary.",
      evidence: "__tests__/admin-cms-browser/built-targets.ts:12",
    },
    {
      why: "Why must acceptance read the built YAML?",
      because: "Sveltia navigation targets must come from the same generated configuration that the pinned browser runtime loads.",
      evidence: "plan-313 sections 3 and 4",
    },
    {
      why: "Why keep these dependencies out of the traversal?",
      because: "The acceptance spec consumes readonly CollectionTarget records and does not read files or parse YAML itself.",
      evidence: "__tests__/admin-cms-browser/acceptance.spec.ts:40",
    },
    {
      why: "Why authorise this file alone?",
      because: "BuiltTargetSource confines the platform reader and parser while readBuiltTargetsWith accepts typed fakes in its boundary tests.",
      evidence: "__tests__/admin-cms-browser/built-targets.test.ts:9",
    },
    {
      why: "Why does this remain outside production?",
      because: "Only the browser acceptance harness imports this built-artifact adapter; CMS startup still loads its own unchanged configuration.",
      evidence: "apps/admin/src/cms/start-cms.ts:3",
    },
  ],
  rootCause: "Acceptance derives navigation targets from a real built artifact, so its Node reader and YAML parser need one confined adapter.",
  rootCheck: "__tests__/admin-cms-browser/built-targets.ts:12 still reads config.yml today.",
  readback: "The adapter is confined, therefore built-targets.ts imports the Node file reader and YAML parser.",
  owner: "Helen",
};

const issuePathsOf = (chain: unknown): readonly string[] => {
  const parsed = whyChainSchema.safeParse(chain);
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.path.join("."));
};

const withWhy = (request: {
  readonly chain: WhyChain;
  readonly position: 0 | 1 | 2 | 3 | 4;
  readonly field: "why" | "because" | "evidence";
  readonly text: string;
}): WhyChain => {
  const replaced = (position: number, step: Why): Why =>
    position === request.position ? { ...step, [request.field]: request.text } : step;
  const [first, second, third, fourth, fifth] = request.chain.whys;
  return {
    ...request.chain,
    whys: [replaced(0, first), replaced(1, second), replaced(2, third), replaced(3, fourth), replaced(4, fifth)],
  };
};

describe("whyChainSchema accepts a chain that runs cause to cause", () => {
  it("accepts five linked whys, a root, its check and a readback", () => {
    expect(issuePathsOf(CAUSAL_CHAIN)).toEqual([]);
  });

  it("parses the chain to the same values", () => {
    expect(whyChainSchema.parse(CAUSAL_CHAIN)).toEqual(CAUSAL_CHAIN);
  });

  it.each([
    ["a URL", "https://github.com/HailsTails/aidlc-workflows/pull/212"],
    ["a record number", "issue #385 ruling"],
    ["a measurement", "git grep counts 3 matches"],
    ["a file name", "the matcher in name-matcher.ts"],
  ])("accepts evidence that is %s", (_label, evidence) => {
    expect(issuePathsOf(withWhy({ chain: CAUSAL_CHAIN, position: 2, field: "evidence", text: evidence }))).toEqual([]);
  });
});

describe("whyChainSchema refuses a chain that lists objections instead of causes", () => {
  it("refuses every why that asks about something the previous answer did not introduce", () => {
    expect(issuePathsOf(OBJECTION_LIST)).toEqual(["whys.2.why", "whys.3.why", "whys.4.why"]);
  });

  it("refuses a why that names only the symptom's own subject", () => {
    expect(
      issuePathsOf(
        withWhy({ chain: CAUSAL_CHAIN, position: 2, field: "why", text: "Why does the audit refuse these names at all?" }),
      ),
    ).toEqual(["whys.2.why"]);
  });

  it("refuses a why that names its subject only by pronoun", () => {
    expect(
      issuePathsOf(withWhy({ chain: CAUSAL_CHAIN, position: 1, field: "why", text: "Why is that the case?" })),
    ).toEqual(["whys.1.why"]);
  });

  it("refuses a root cause that names nothing the fifth answer introduced", () => {
    expect(
      issuePathsOf({ ...CAUSAL_CHAIN, rootCause: "The audit refuses tracker ids in carve-out names by design." }),
    ).toEqual(expect.arrayContaining(["rootCause"]));
  });
});

describe("causalProblemsOf refuses the objection lists the Gate 1 and 3 pilot recorded", () => {
  const pilotChain = (request: { readonly steps: readonly (readonly [string, string, string])[] }): WhyChain => {
    const [first, second, third, fourth] = request.steps.map(([why, because, evidence]) => ({ why, because, evidence }));
    const root = { why: "Why does the root hold?", because: "the root is recorded below", evidence: "this chain's root" };
    return {
      ...CAUSAL_CHAIN,
      whys: [first ?? root, second ?? root, third ?? root, fourth ?? root, root],
    };
  };

  const linkProblemsOf = (chain: WhyChain): readonly string[] =>
    causalProblemsOf({ chain })
      .filter((problem) => problem.path.at(-1) === "why")
      .map((problem) => problem.path.join("."));

  it("refuses links 2 to 4 of the case 2 line-number push-back", () => {
    expect(
      linkProblemsOf(
        pilotChain({
          steps: [
            ["Why is no artefact edited?", "Because the wrong coordinates are written in two lens reports", "rin-completeness-reviewer-agent.md:79"],
            ["Why can the lead not correct them?", "Because Step 6 says the scribe preserves each lens's reported location and requests that lens's own supplement", "decorrelated-review.md:118"],
            ["Why does that leave the findings answerable?", "Because each finding also names its case id, C-79 and C-77, which resolve uniquely", "decisions.md C-77"],
            ["Why is that enough for re-review?", "Because both cases were fixed under F1, F2 and G2 above", "this table, rows F1 and F2"],
          ],
        }),
      ),
    ).toEqual(expect.arrayContaining(["whys.1.why", "whys.2.why", "whys.3.why"]));
  });

  it("refuses links 2 to 4 of case 1's known limit on raw HTML in the long description", () => {
    expect(
      linkProblemsOf(
        pilotChain({
          steps: [
            ["Why is this left as it is?", "Because no catalogue file holds HTML in either description", "M-10, facts.md"],
            ["Why would it not reach a shopper?", "Because only a closed set of editors behind Cloudflare Access can write descriptions, and each save opens a pull request with a storefront preview", "Q-C6"],
            ["Why is that enough?", "Because PD-1 condition 3 starts handling at nothing, recorded once as a known limit, and climbs only for a harm ordinary use reaches", "pd-001 condition 3"],
            ["Why not make it consistent with FR-4 anyway?", "Because consistency with another requirement is not a reason under PD-1 condition 1", "pd-001 condition 1"],
          ],
        }),
      ),
    ).toEqual(expect.arrayContaining(["whys.1.why", "whys.2.why", "whys.3.why"]));
  });
});

describe("whyChainSchema refuses a chain that restates one reason", () => {
  it("refuses an answer that rewords an earlier answer", () => {
    expect(
      issuePathsOf(
        withWhy({
          chain: CAUSAL_CHAIN,
          position: 3,
          field: "because",
          text: "When the audit landed, no shared slug type existed, so each tool wrote its own pattern.",
        }),
      ),
    ).toEqual(expect.arrayContaining(["whys.3.because"]));
  });
});

describe("whyChainSchema refuses evidence that cannot be checked again", () => {
  it.each([
    ["prose naming a document", "Cloudflare Pages redirects documentation"],
    ["prose describing an assertion", "The assertion compares the whole field list with toEqual"],
    ["prose with an e.g. abbreviation", "the redirects documentation, e.g. the wiki"],
    ["prose with an i.e. abbreviation", "the hosting docs, i.e. the guide"],
    ["prose with and/or", "see the docs and/or the wiki"],
  ])("refuses %s", (_label, evidence) => {
    expect(issuePathsOf(withWhy({ chain: CAUSAL_CHAIN, position: 2, field: "evidence", text: evidence }))).toEqual([
      "whys.2.evidence",
    ]);
  });
});

describe("whyChainSchema names the right remedy for evidence", () => {
  const messagesOf = (chain: WhyChain): readonly string[] => {
    const parsed = whyChainSchema.safeParse(chain);
    return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
  };

  it("asks for real evidence, not a locator, when the evidence is located but too short", () => {
    expect(messagesOf(withWhy({ chain: CAUSAL_CHAIN, position: 2, field: "evidence", text: "PR #212" }))).toEqual([
      expect.stringContaining("carries no real `evidence`"),
    ]);
  });

  it("asks for a locator when the evidence is long enough but cites nothing checkable", () => {
    expect(
      messagesOf(withWhy({ chain: CAUSAL_CHAIN, position: 2, field: "evidence", text: "the redirects documentation" })),
    ).toEqual([expect.stringContaining("carries no checkable `evidence`")]);
  });
});

describe("whyChainSchema links through a plural and its singular", () => {
  it("accepts a why that names the previous answer's words in their plural and a readback that names the symptom in its singular", () => {
    const [first, second, third, fourth, fifth] = CAUSAL_CHAIN.whys;
    const chain: WhyChain = {
      ...CAUSAL_CHAIN,
      whys: [
        { ...first, because: "Each finding becomes one string, and tracker ids carry uppercase letters." },
        { ...second, why: "Why does each of the findings become strings?" },
        third,
        fourth,
        fifth,
      ],
      readback: CAUSAL_CHAIN.readback.replace("refuses tracker ids in carve-out names", "refuses a tracker id in a carve-out name"),
    };
    expect(issuePathsOf(chain)).toEqual([]);
  });
});

describe("whyChainSchema refuses a root that is not checked against today", () => {
  it.each([
    ["no root check", (({ rootCheck: _, ...rest }) => rest)(CAUSAL_CHAIN)],
    ["a root check with nothing to check", { ...CAUSAL_CHAIN, rootCheck: "the monorepo move is still incomplete today" }],
  ])("refuses %s", (_label, chain) => {
    expect(issuePathsOf(chain)).toEqual(["rootCheck"]);
  });
});

describe("whyChainSchema refuses a readback that does not run from root to symptom", () => {
  it.each([
    ["no readback", (({ readback: _, ...rest }) => rest)(CAUSAL_CHAIN)],
    [
      "a readback with no therefore",
      { ...CAUSAL_CHAIN, readback: "Older tools carry pre-monorepo patterns, so the audit refuses tracker ids in carve-out names." },
    ],
    [
      "a readback that never names the symptom",
      { ...CAUSAL_CHAIN, readback: "Older tools carry pre-monorepo patterns, therefore the matcher is lowercase." },
    ],
    [
      "a readback that never names the root",
      { ...CAUSAL_CHAIN, readback: "The matcher is lowercase, therefore the audit refuses tracker ids in carve-out names." },
    ],
  ])("refuses %s", (_label, chain) => {
    expect(issuePathsOf(chain)).toEqual(["readback"]);
  });
});

describe("whyChainSchema keeps the five-why floor", () => {
  it.each([
    ["four whys", { ...CAUSAL_CHAIN, whys: CAUSAL_CHAIN.whys.slice(0, 4) }],
    ["six whys", { ...CAUSAL_CHAIN, whys: [...CAUSAL_CHAIN.whys, CAUSAL_CHAIN.whys[4]] }],
    ["a placeholder answer", withWhy({ chain: CAUSAL_CHAIN, position: 1, field: "because", text: "tbd" })],
    ["a root that restates the exception", { ...CAUSAL_CHAIN, rootCause: "there was no time to pay the monorepo debt down" }],
    ["no owner", (({ owner: _, ...rest }) => rest)(CAUSAL_CHAIN)],
  ])("refuses %s", (_label, chain) => {
    expect(whyChainSchema.safeParse(chain).success).toBe(false);
  });
});

describe("whyChainFormOf tells a causal chain from one written to the legacy contract", () => {
  it.each([
    ["a chain with a readback and a root check", "causal", CAUSAL_CHAIN],
    ["a chain with only a root check", "causal", (({ readback: _, ...rest }) => rest)(CAUSAL_CHAIN)],
    ["a chain with only a readback", "causal", (({ rootCheck: _, ...rest }) => rest)(CAUSAL_CHAIN)],
    ["a chain with neither", "legacy", (({ rootCheck: _, readback: __, ...rest }) => rest)(CAUSAL_CHAIN)],
    ["a value that is not a chain", "causal", "five whys"],
  ])("reads %s as %s", (_label, form, chain) => {
    expect(whyChainFormOf({ chain })).toBe(form);
  });
});
