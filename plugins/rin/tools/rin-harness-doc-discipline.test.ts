import { describe, expect, test } from "vitest";
import {
  findBareFigureFindings,
  findKeyIntegrityFindings,
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
