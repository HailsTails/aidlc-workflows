import { describe, expect, test } from "vitest";
import type {
  DecisionPoint,
  LedgerCandidate,
} from "./rin-gates-options-ledger.ts";
import { ledgerShapeFindings } from "./rin-gates-solution-options.ts";

const FLAT_FILES_CANDIDATE: LedgerCandidate = {
  letter: "A",
  name: "Flat files",
  lineNumber: 2,
  premises: { kind: "keys", keys: ["GR-3"] },
};

const SQLITE_CANDIDATE: LedgerCandidate = {
  letter: "B",
  name: "SQLite",
  lineNumber: 4,
  premises: { kind: "none", reason: "local" },
};

const WELL_FORMED_POINT: DecisionPoint = {
  name: "storage",
  lineNumber: 1,
  candidates: [FLAT_FILES_CANDIDATE, SQLITE_CANDIDATE],
  chosenLine: { kind: "resolved", candidate: SQLITE_CANDIDATE, lineNumber: 7 },
  rejections: [
    {
      letter: "A",
      reason: { kind: "stated", text: "loses data on crash" },
      lineNumber: 8,
    },
  ],
};

describe("ledgerShapeFindings", () => {
  test("accepts a point with two candidates, premises, a chosen one and a reason for the other", () => {
    expect(
      ledgerShapeFindings({ ledger: { points: [WELL_FORMED_POINT] } }),
    ).toEqual([]);
  });

  test("refuses a ledger with no decision point", () => {
    expect(ledgerShapeFindings({ ledger: { points: [] } })).toEqual([
      {
        check: "solution-options/ledger",
        artefact: "rin-solution-options.md",
        location: { kind: "artefact" },
        subject: "no `## Point: <name>` section",
        remedy:
          "Record each decision point as `## Point: <name>` with its candidates and the decision.",
      },
    ]);
  });

  test("refuses a point with a single candidate", () => {
    expect(
      ledgerShapeFindings({
        ledger: {
          points: [
            {
              name: "storage",
              lineNumber: 1,
              candidates: [FLAT_FILES_CANDIDATE],
              chosenLine: {
                kind: "resolved",
                candidate: FLAT_FILES_CANDIDATE,
                lineNumber: 4,
              },
              rejections: [],
            },
          ],
        },
      }),
    ).toEqual([
      {
        check: "solution-options/ledger",
        artefact: "rin-solution-options.md",
        location: { kind: "line", lineNumber: 1 },
        subject: "Point storage has 1 distinct candidate(s)",
        remedy:
          "A decision point compares at least 2 genuinely different candidates; whether a third was needed is the board's judgement.",
      },
    ]);
  });

  test("refuses a point listing one letter twice, counting it once toward the floor", () => {
    expect(
      ledgerShapeFindings({
        ledger: {
          points: [
            {
              name: "storage",
              lineNumber: 1,
              candidates: [
                FLAT_FILES_CANDIDATE,
                {
                  letter: "A",
                  name: "Flat files, again",
                  lineNumber: 4,
                  premises: { kind: "keys", keys: ["TR-1"] },
                },
              ],
              chosenLine: { kind: "ambiguous", letter: "A", lineNumber: 6 },
              rejections: [],
            },
          ],
        },
      }),
    ).toEqual([
      {
        check: "solution-options/ledger",
        artefact: "rin-solution-options.md",
        location: { kind: "line", lineNumber: 1 },
        subject: "Point storage has 1 distinct candidate(s)",
        remedy:
          "A decision point compares at least 2 genuinely different candidates; whether a third was needed is the board's judgement.",
      },
      {
        check: "solution-options/ledger",
        artefact: "rin-solution-options.md",
        location: { kind: "line", lineNumber: 4 },
        subject: "Point storage lists candidate A twice",
        remedy:
          "A letter names one candidate within its point: give this candidate the next unused letter.",
      },
      {
        check: "solution-options/ledger",
        artefact: "rin-solution-options.md",
        location: { kind: "line", lineNumber: 6 },
        subject:
          "Point storage chose A, which names more than one of its candidates",
        remedy:
          "Give each candidate its own letter, then choose exactly one of them.",
      },
    ]);
  });

  test("refuses a missing and a malformed Premises line", () => {
    expect(
      ledgerShapeFindings({
        ledger: {
          points: [
            {
              ...WELL_FORMED_POINT,
              candidates: [
                { ...FLAT_FILES_CANDIDATE, premises: { kind: "missing" } },
                {
                  ...SQLITE_CANDIDATE,
                  premises: {
                    kind: "malformed",
                    text: "the vendor docs",
                    lineNumber: 5,
                  },
                },
              ],
            },
          ],
        },
      }),
    ).toEqual([
      {
        check: "solution-options/ledger",
        artefact: "rin-solution-options.md",
        location: { kind: "line", lineNumber: 2 },
        subject: "Point storage, candidate A: no Premises line",
        remedy:
          "Add `- **Premises:** <KEY>, <KEY>` naming its facts.md rows, or `- **Premises:** none — <reason>`.",
      },
      {
        check: "solution-options/ledger",
        artefact: "rin-solution-options.md",
        location: { kind: "line", lineNumber: 5 },
        subject: 'Point storage, candidate B: Premises reads "the vendor docs"',
        remedy:
          "List facts.md keys (uppercase letters, a hyphen, then digits, e.g. `OT-1`) separated by commas, or write `none — <reason>`.",
      },
    ]);
  });

  test("refuses a point with no Chosen line", () => {
    expect(
      ledgerShapeFindings({
        ledger: {
          points: [{ ...WELL_FORMED_POINT, chosenLine: { kind: "missing" } }],
        },
      }),
    ).toEqual([
      {
        check: "solution-options/ledger",
        artefact: "rin-solution-options.md",
        location: { kind: "line", lineNumber: 1 },
        subject: "Point storage has no Chosen line",
        remedy: "Add `- **Chosen:** <letter>` under the point.",
      },
    ]);
  });

  test("refuses a malformed Chosen line", () => {
    expect(
      ledgerShapeFindings({
        ledger: {
          points: [
            {
              ...WELL_FORMED_POINT,
              chosenLine: {
                kind: "malformed",
                text: "B, probably",
                lineNumber: 7,
              },
            },
          ],
        },
      }),
    ).toEqual([
      {
        check: "solution-options/ledger",
        artefact: "rin-solution-options.md",
        location: { kind: "line", lineNumber: 7 },
        subject: 'Point storage: Chosen reads "B, probably"',
        remedy: "Write the Chosen line as `- **Chosen:** <letter>`.",
      },
    ]);
  });

  test("refuses a chosen letter that is not one of the point's candidates", () => {
    expect(
      ledgerShapeFindings({
        ledger: {
          points: [
            {
              ...WELL_FORMED_POINT,
              chosenLine: {
                kind: "not-a-candidate",
                letter: "Z",
                lineNumber: 7,
              },
            },
          ],
        },
      }),
    ).toEqual([
      {
        check: "solution-options/ledger",
        artefact: "rin-solution-options.md",
        location: { kind: "line", lineNumber: 7 },
        subject: "Point storage chose Z, which is not one of its candidates",
        remedy: "Choose one of the point's own candidate letters.",
      },
    ]);
  });

  test("refuses a Rejected line naming the chosen candidate", () => {
    expect(
      ledgerShapeFindings({
        ledger: {
          points: [
            {
              ...WELL_FORMED_POINT,
              rejections: [
                {
                  letter: "A",
                  reason: { kind: "stated", text: "loses data on crash" },
                  lineNumber: 8,
                },
                {
                  letter: "B",
                  reason: { kind: "stated", text: "too heavy" },
                  lineNumber: 9,
                },
              ],
            },
          ],
        },
      }),
    ).toEqual([
      {
        check: "solution-options/ledger",
        artefact: "rin-solution-options.md",
        location: { kind: "line", lineNumber: 9 },
        subject: "Point storage both chooses and rejects candidate B",
        remedy:
          "Remove the Rejected line for the chosen candidate, or choose a different candidate.",
      },
    ]);
  });

  test("refuses a Rejected line naming a letter that is not one of the point's candidates", () => {
    expect(
      ledgerShapeFindings({
        ledger: {
          points: [
            {
              ...WELL_FORMED_POINT,
              rejections: [
                {
                  letter: "A",
                  reason: { kind: "stated", text: "loses data on crash" },
                  lineNumber: 8,
                },
                {
                  letter: "Q",
                  reason: { kind: "stated", text: "never proposed" },
                  lineNumber: 9,
                },
              ],
            },
          ],
        },
      }),
    ).toEqual([
      {
        check: "solution-options/ledger",
        artefact: "rin-solution-options.md",
        location: { kind: "line", lineNumber: 9 },
        subject: "Point storage rejects Q, which is not one of its candidates",
        remedy: "Reject only the point's own candidate letters.",
      },
    ]);
  });

  test("refuses a foreign Rejected letter even when the point has no readable Chosen line", () => {
    expect(
      ledgerShapeFindings({
        ledger: {
          points: [
            {
              ...WELL_FORMED_POINT,
              chosenLine: { kind: "missing" },
              rejections: [
                {
                  letter: "Q",
                  reason: { kind: "stated", text: "never proposed" },
                  lineNumber: 9,
                },
              ],
            },
          ],
        },
      }),
    ).toEqual([
      {
        check: "solution-options/ledger",
        artefact: "rin-solution-options.md",
        location: { kind: "line", lineNumber: 1 },
        subject: "Point storage has no Chosen line",
        remedy: "Add `- **Chosen:** <letter>` under the point.",
      },
      {
        check: "solution-options/ledger",
        artefact: "rin-solution-options.md",
        location: { kind: "line", lineNumber: 9 },
        subject: "Point storage rejects Q, which is not one of its candidates",
        remedy: "Reject only the point's own candidate letters.",
      },
    ]);
  });

  test("refuses an unchosen candidate with no rejection reason", () => {
    expect(
      ledgerShapeFindings({
        ledger: { points: [{ ...WELL_FORMED_POINT, rejections: [] }] },
      }),
    ).toEqual([
      {
        check: "solution-options/ledger",
        artefact: "rin-solution-options.md",
        location: { kind: "line", lineNumber: 2 },
        subject: "Point storage gives no reason for rejecting candidate A",
        remedy: "Add `- **Rejected A:** <reason>` under the point.",
      },
    ]);
  });

  test("refuses an unchosen candidate whose Rejected line states no reason", () => {
    expect(
      ledgerShapeFindings({
        ledger: {
          points: [
            {
              ...WELL_FORMED_POINT,
              rejections: [
                { letter: "A", reason: { kind: "unstated" }, lineNumber: 8 },
              ],
            },
          ],
        },
      }),
    ).toEqual([
      {
        check: "solution-options/ledger",
        artefact: "rin-solution-options.md",
        location: { kind: "line", lineNumber: 2 },
        subject: "Point storage gives no reason for rejecting candidate A",
        remedy: "Add `- **Rejected A:** <reason>` under the point.",
      },
    ]);
  });

  test("refuses a reasonless Rejected line naming the chosen candidate", () => {
    expect(
      ledgerShapeFindings({
        ledger: {
          points: [
            {
              ...WELL_FORMED_POINT,
              rejections: [
                {
                  letter: "A",
                  reason: { kind: "stated", text: "loses data on crash" },
                  lineNumber: 8,
                },
                { letter: "B", reason: { kind: "unstated" }, lineNumber: 9 },
              ],
            },
          ],
        },
      }),
    ).toEqual([
      {
        check: "solution-options/ledger",
        artefact: "rin-solution-options.md",
        location: { kind: "line", lineNumber: 9 },
        subject: "Point storage both chooses and rejects candidate B",
        remedy:
          "Remove the Rejected line for the chosen candidate, or choose a different candidate.",
      },
    ]);
  });

  test("refuses a reasonless Rejected line naming a letter that is not one of the point's candidates", () => {
    expect(
      ledgerShapeFindings({
        ledger: {
          points: [
            {
              ...WELL_FORMED_POINT,
              rejections: [
                {
                  letter: "A",
                  reason: { kind: "stated", text: "loses data on crash" },
                  lineNumber: 8,
                },
                { letter: "Q", reason: { kind: "unstated" }, lineNumber: 9 },
              ],
            },
          ],
        },
      }),
    ).toEqual([
      {
        check: "solution-options/ledger",
        artefact: "rin-solution-options.md",
        location: { kind: "line", lineNumber: 9 },
        subject: "Point storage rejects Q, which is not one of its candidates",
        remedy: "Reject only the point's own candidate letters.",
      },
    ]);
  });
});
