import { describe, expect, test } from "vitest";
import {
  findBareFigureFindings,
  findKeyIntegrityFindings,
  findUnchainedExceptionFindings,
  inspectRecordDirectory,
} from "./rin-harness-doc-discipline.ts";

const FACTS = [
  "| key | claim | value | re-derive | status | corrected-by |",
  "|---|---|---|---|---|---|",
  "| **Q-1** | Records in the projection | 283 | `pnpm rin-gates:status` | live | |",
  "| **Q-2** | Of Q-1, intake-owned | 228 | projection | live | |",
  "| **R-1** | Seats measured | 4,226 | `summarise-audit-seats.ts` | live | |",
].join("\n");

const gate1 = {
  name: "rin-requirements.md",
  body: "Intake carries Q-2 of Q-1.",
};
const gate4 = {
  name: "rin-code-generation-plan.md",
  body: "Seats measured: R-1.",
};

describe("DD-1/DD-3 key integrity — the path it must ALLOW", () => {
  test("a compliant record yields no findings", () => {
    expect(
      findKeyIntegrityFindings({
        factsBody: FACTS,
        proseDocuments: [gate1, gate4],
      }),
    ).toEqual([]);
  });

  test("a key defined at one gate and referenced at a later gate RESOLVES (DD-3)", () => {
    const later = {
      name: "rin-disposition-table.md",
      body: "Per Q-1 and R-1, proceed.",
    };
    const findings = findKeyIntegrityFindings({
      factsBody: FACTS,
      proseDocuments: [gate1, later],
    });
    expect(findings.filter((finding) => finding.subject === "Q-1")).toEqual([]);
  });

  test("rule-id citations are not fact references (DD-4, CD-19, IF-7)", () => {
    const citing = {
      name: "rin-requirements.md",
      body: "Population per DD-4; throws per CD-19; the lock is IF-7. Facts Q-1 Q-2 R-1.",
    };
    expect(
      findKeyIntegrityFindings({ factsBody: FACTS, proseDocuments: [citing] }),
    ).toEqual([]);
  });

  test("orphan detection unions references across artefacts, not per file", () => {
    const findings = findKeyIntegrityFindings({
      factsBody: FACTS,
      proseDocuments: [gate1, gate4],
    });
    expect(findings.filter((finding) => finding.subject === "R-1")).toEqual([]);
  });
});

describe("DD-1/DD-3 key integrity — the defects it must CATCH", () => {
  test("a reference with no row is reported with a remedy", () => {
    const findings = findKeyIntegrityFindings({
      factsBody: FACTS,
      proseDocuments: [
        { name: "rin-requirements.md", body: "See M-5 and Q-1, Q-2, R-1." },
      ],
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toBe("DD-1");
    expect(findings[0]?.remedy).toContain("Add a row for M-5");
  });

  test("a key defined twice is a DD-3 duplicate", () => {
    const facts = [FACTS, "| **Q-1** | Restated | 999 | cmd | live | |"].join(
      "\n",
    );
    const findings = findKeyIntegrityFindings({
      factsBody: facts,
      proseDocuments: [gate1, gate4],
    });
    expect(findings.map((finding) => finding.rule)).toContain("DD-3");
  });

  test("a row referenced by no official artefact is a DD-3 orphan", () => {
    const facts = [FACTS, "| **R-2** | Unused | 7 | cmd | live | |"].join("\n");
    const findings = findKeyIntegrityFindings({
      factsBody: facts,
      proseDocuments: [gate1, gate4],
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.subject).toBe("R-2");
  });

  test("keys out of numeric order within a prefix are reported", () => {
    const facts = [
      FACTS,
      "| **Q-9** | Later | 1 | cmd | live | |",
      "| **Q-4** | Earlier | 2 | cmd | live | |",
    ].join("\n");
    const prose = [
      { name: "rin-requirements.md", body: "Q-1 Q-2 R-1 Q-9 Q-4." },
    ];
    const findings = findKeyIntegrityFindings({
      factsBody: facts,
      proseDocuments: prose,
    });
    expect(findings.map((finding) => finding.rule)).toContain("DD-1");
  });
});

describe("DD-2 bare figures", () => {
  test("dates, slugs, PR and gate references are exempt", () => {
    const prose = [
      {
        name: "rin-requirements.md",
        body: "Measured 2026-09-06 on 260905-lane-cadence in #827 at Gate 3. Facts Q-1 Q-2 R-1.",
      },
    ];
    expect(findBareFigureFindings({ proseDocuments: prose })).toEqual([]);
  });

  test("a linked PR reference is exempt on both halves", () => {
    const prose = [
      {
        name: "rin-reconcile-report.md",
        body: "Merged as [#900](https://github.com/HailsTails/rin/pull/900).",
      },
    ];
    expect(findBareFigureFindings({ proseDocuments: prose })).toEqual([]);
  });

  test.each([
    ["sha256"],
    ["sha-1"],
    ["base64"],
    ["utf8"],
  ])("the algorithm name %s is exempt", (name) => {
    expect(
      findBareFigureFindings({
        proseDocuments: [
          {
            name: "rin-interface-lock.md",
            body: `The digest is ${name} over the entry.`,
          },
        ],
      }),
    ).toEqual([]);
  });

  test("a real figure next to an algorithm name still fires", () => {
    const findings = findBareFigureFindings({
      proseDocuments: [
        {
          name: "rin-interface-lock.md",
          body: "The sha256 digest is truncated to 4096 characters.",
        },
      ],
    });
    expect(findings.map((finding) => finding.subject)).toEqual(["4096"]);
  });

  test("a reviewer receipt token is exempt", () => {
    const prose = [
      {
        name: "rin-requirements.md",
        body: "**Request Challenge:** review:2b390d86a8efba1be79dca282c578da0",
      },
    ];
    expect(findBareFigureFindings({ proseDocuments: prose })).toEqual([]);
  });

  test("figures in fenced blocks and table rows are exempt", () => {
    const prose = [
      {
        name: "rin-requirements.md",
        body: ["| ratio | 4.5x |", "```", "count = 8419", "```"].join("\n"),
      },
    ];
    expect(findBareFigureFindings({ proseDocuments: prose })).toEqual([]);
  });

  test("a bare figure in prose is reported with a remedy", () => {
    const prose = [
      {
        name: "rin-requirements.md",
        body: "Worst cases run to 9.0x per identifier.",
      },
    ];
    const findings = findBareFigureFindings({ proseDocuments: prose });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toBe("DD-2");
    expect(findings[0]?.subject).toBe("9.0");
    expect(findings[0]?.remedy).toContain("Move it into a facts.md row");
  });
});

const CHAIN = [
  "why-chain:",
  "1. why deferred? because the walker cannot express the tracker id.",
  "2. why not? because its matcher is the retired Spec-Kit pattern.",
  "3. why still? because no AIDLC id satisfies that shape.",
  "4. why unfixed? because the matcher was never re-minted.",
  "5. root cause: the matcher outlived its numbering scheme. owner: capture 01a0b421.",
].join("\n");

describe("DD-1 self-numbering — scoped to the framing artefact", () => {
  test("headed Q-/D- in the framing artefact need no facts row", () => {
    expect(
      findKeyIntegrityFindings({
        factsBody: FACTS,
        proseDocuments: [
          {
            name: "rin-framing-questions.md",
            body: "### Q-1\n\nSettled. See D-3 and Q-2.\n\n### D-3\n\n### Q-2",
          },
          gate1,
          gate4,
        ],
      }).filter((finding) => finding.artefact === "rin-framing-questions.md"),
    ).toEqual([]);
  });

  test("the SAME keys in any other artefact still dangle", () => {
    expect(
      findKeyIntegrityFindings({
        factsBody: FACTS,
        proseDocuments: [
          { name: "rin-components.md", body: "Per D-3 the seam moves." },
          gate1,
          gate4,
        ],
      }).some(
        (finding) =>
          finding.artefact === "rin-components.md" && finding.subject === "D-3",
      ),
    ).toBe(true);
  });

  test("a framing key without its own heading still dangles", () => {
    const findings = findKeyIntegrityFindings({
      factsBody: FACTS,
      proseDocuments: [
        { name: "rin-framing-questions.md", body: "### D-1\n\nSee D-4." },
        gate1,
        gate4,
      ],
    });
    expect(findings.some((finding) => finding.subject === "D-4")).toBe(true);
  });

  test("a plan question key requires a matching local heading", () => {
    const findings = findKeyIntegrityFindings({
      factsBody: FACTS,
      proseDocuments: [
        {
          name: "rin-plan-review-questions.md",
          body: "## D-1 — settled\n\nD-1 cites D-4.",
        },
        gate1,
        gate4,
      ],
    });
    expect(findings.some((finding) => finding.subject === "D-1")).toBe(false);
    expect(findings.some((finding) => finding.subject === "D-4")).toBe(true);
  });

  test.each([
    "rin-interface-lock.md",
    "rin-disposition-table.md",
  ])("%s does not grant a free local key", (name) => {
    const findings = findKeyIntegrityFindings({
      factsBody: FACTS,
      proseDocuments: [
        { name, body: "D-4 and R-4 remain unbound." },
        gate1,
        gate4,
      ],
    });
    expect(findings.map((finding) => finding.subject)).toContain("D-4");
    expect(findings.map((finding) => finding.subject)).toContain("R-4");
  });

  test("a real fact key in the framing artefact still resolves", () => {
    expect(
      findKeyIntegrityFindings({
        factsBody: FACTS,
        proseDocuments: [
          { name: "rin-framing-questions.md", body: "### Q-1\n\nQ-2 of Q-1." },
          gate4,
        ],
      }).some((finding) => finding.subject === "Q-2"),
    ).toBe(false);
  });
});

describe("DD-7 exception chains — the path it must ALLOW", () => {
  test("an artefact making no exception claim yields no findings", () => {
    expect(
      findUnchainedExceptionFindings({
        proseDocuments: [
          {
            name: "rin-requirements.md",
            body: "## Scope\n\nThe seam is the loader.",
          },
        ],
      }),
    ).toEqual([]);
  });

  test.each([
    ["the contract's hyphenated form", "why-chain"],
    ["R7's own phrase", "Five Whys"],
  ])("the %s label alone marks a section as chained", (_label, spelling) => {
    expect(
      findUnchainedExceptionFindings({
        proseDocuments: [
          {
            name: "rin-components.md",
            body: `## Boundary\n\nThe adjacent caller is deferred.\n\n${spelling}: 1. the walker cannot express it 2. its matcher predates AIDLC 3. no id satisfies it 4. nobody re-minted it`,
          },
        ],
      }),
    ).toEqual([]);
  });

  test("an exception claim with its chain in the same section is clean", () => {
    expect(
      findUnchainedExceptionFindings({
        proseDocuments: [
          {
            name: "rin-components.md",
            body: `## Boundary\n\nThe adjacent caller is deferred.\n\n${CHAIN}`,
          },
        ],
      }),
    ).toEqual([]);
  });

  test("one chain serves every exception claim in its own section", () => {
    expect(
      findUnchainedExceptionFindings({
        proseDocuments: [
          {
            name: "rin-components.md",
            body: `## Boundary\n\nThe caller is deferred.\nThe sibling is out of scope.\n\n${CHAIN}`,
          },
        ],
      }),
    ).toEqual([]);
  });

  test("a prose chain ending at a named root cause counts as a chain", () => {
    expect(
      findUnchainedExceptionFindings({
        proseDocuments: [
          {
            name: "rin-components.md",
            body: "## Boundary\n\nThe adjacent caller is deferred.\n\nAsking why four times gets to the matcher; the root cause is that it outlived the numbering scheme it was minted for. Owner: capture 01a0b421.",
          },
        ],
      }),
    ).toEqual([]);
  });

  test("a numbered why-table reading to a root cause counts as a chain", () => {
    expect(
      findUnchainedExceptionFindings({
        proseDocuments: [
          {
            name: "rin-readiness-verdict.md",
            body: [
              "## Decision",
              "",
              "The remaining callers are deferred.",
              "",
              "| why | because | evidence |",
              "|---|---|---|",
              "| 1. why? | because a | `git log` |",
              "| 5. root cause | the matcher outlived its scheme. owner: 01a0b421. | `cd-5.json` |",
            ].join("\n"),
          },
        ],
      }),
    ).toEqual([]);
  });

  test.each([
    ["inline code", "The loader reads the `carve-out` registry entries."],
    [
      "a quoted source",
      'Entries read "inherited debt tracked under the program".',
    ],
  ])("an exception word in %s is not a claim", (_label, sentence) => {
    expect(
      findUnchainedExceptionFindings({
        proseDocuments: [
          { name: "rin-reconcile-report.md", body: `## Scope\n\n${sentence}` },
        ],
      }),
    ).toEqual([]);
  });

  test.each([
    [
      "the registry by name",
      "The loader reads the carve-out registry entries.",
    ],
    [
      "a clean checks line",
      "audit:harness PASS, 0 violations. No carve-out taken.",
    ],
    [
      "an enumeration of the governed acts",
      "R7 names a carve-out grant, an authorised-location grant, and a lock re-widening.",
    ],
  ])("an exception noun in %s is not a claim", (_label, sentence) => {
    expect(
      findUnchainedExceptionFindings({
        proseDocuments: [
          { name: "rin-requirements.md", body: `## Scope\n\n${sentence}` },
        ],
      }),
    ).toEqual([]);
  });

  test.each([
    ["is out of scope", "The sibling package is out of scope here."],
    ["stays inherited debt", "These casts stay inherited debt for now."],
    ["was carved out", "The suite was carved out of the audit."],
    ["is deferred", "The adjacent caller is deferred to a later record."],
  ])("a genuine claim that something %s still fires", (_label, sentence) => {
    expect(
      findUnchainedExceptionFindings({
        proseDocuments: [
          { name: "rin-components.md", body: `## Boundary\n\n${sentence}` },
        ],
      }),
    ).toHaveLength(1);
  });

  test("an exception word in a table cell is data, not a claim", () => {
    expect(
      findUnchainedExceptionFindings({
        proseDocuments: [
          {
            name: "rin-components.md",
            body: "## Table\n\n| item | state |\n|---|---|\n| callers | deferred |",
          },
        ],
      }),
    ).toEqual([]);
  });

  test("an exception word inside a fenced block is not a claim", () => {
    expect(
      findUnchainedExceptionFindings({
        proseDocuments: [
          {
            name: "rin-requirements.md",
            body: "## Grammar\n\n```\ndeferred | out of scope\n```",
          },
        ],
      }),
    ).toEqual([]);
  });
});

describe("DD-7 exception chains — the path it must REFUSE", () => {
  test.each([
    ["deferred", "The adjacent caller is deferred to a later record."],
    ["out of scope", "The sibling package is out of scope here."],
    ["inherited debt", "These casts are inherited debt and stay."],
    ["carved out", "The suite is carved out of the audit."],
    ["grandfathered", "Existing entries are grandfathered."],
  ])("a claim of %s with no chain is reported", (_label, sentence) => {
    const findings = findUnchainedExceptionFindings({
      proseDocuments: [
        { name: "rin-components.md", body: `## Boundary\n\n${sentence}` },
      ],
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toBe("DD-7");
  });

  test("the remedy names the chain's required shape", () => {
    const findings = findUnchainedExceptionFindings({
      proseDocuments: [
        { name: "rin-components.md", body: "## Boundary\n\nIt is deferred." },
      ],
    });
    expect(findings[0]?.remedy).toContain("root cause and its owner");
  });

  test("a chain in another section does not cover this claim", () => {
    const findings = findUnchainedExceptionFindings({
      proseDocuments: [
        {
          name: "rin-components.md",
          body: `## Reasoned\n\nThis one is deferred.\n\n${CHAIN}\n\n## Unreasoned\n\nThis one is also deferred.`,
        },
      ],
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.subject).toContain("also deferred");
  });
});

describe("inspectRecordDirectory reports an unmeasurable input", () => {
  test("an absent stage graph is unmeasurable, never a clean pass", () => {
    expect(
      inspectRecordDirectory({
        recordDir: "/nonexistent/record",
        stageGraphPath: "/nonexistent/stage-graph.json",
      }),
    ).toEqual({ kind: "unmeasurable", reason: "no-stage-graph" });
  });

  test("the unmeasurable arm is distinguishable from an empty finding list", () => {
    expect(
      inspectRecordDirectory({
        recordDir: "/nonexistent/record",
        stageGraphPath: "/nonexistent/stage-graph.json",
      }).kind,
    ).not.toBe("inspected");
  });
});

describe("DD-7 exception chains — a NEGATED claim takes no exception", () => {
  test.each([
    ["never", "They are never deferred as inherited debt."],
    ["nothing", "Nothing here is deferred."],
    ["must not", "This must not be deferred."],
    ["not", "The sibling package is not out of scope here."],
    ["no", "There is no carved out region in this walker."],
    ["cannot", "These entries cannot be grandfathered."],
    ["none", "None deferred, none pushed back, and nothing carved out."],
  ])("a sentence FORBIDDING a %s claim is not reported", (_label, sentence) => {
    expect(
      findUnchainedExceptionFindings({
        proseDocuments: [
          { name: "rin-interface-lock.md", body: `## Scope\n\n${sentence}` },
        ],
      }),
    ).toHaveLength(0);
  });

  test("a real claim still flags when the section also negates elsewhere", () => {
    const findings = findUnchainedExceptionFindings({
      proseDocuments: [
        {
          name: "rin-components.md",
          body: "## Scope\n\nNothing here is deferred.\n\nThe adjacent caller is deferred to a later record.",
        },
      ],
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.subject).toContain("adjacent caller");
  });

  test("a negator far from the claim does not suppress it", () => {
    const findings = findUnchainedExceptionFindings({
      proseDocuments: [
        {
          name: "rin-components.md",
          body: "## Scope\n\nNo reviewer objected to the boundary, the schema, the naming, or the port wiring, and the adjacent caller is deferred.",
        },
      ],
    });
    expect(findings).toHaveLength(1);
  });
});
