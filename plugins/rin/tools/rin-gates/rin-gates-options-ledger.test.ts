import { describe, expect, test } from "vitest";
import {
  chosenPremisesOf,
  type DecisionPoint,
  type LedgerCandidate,
  parseOptionsLedger,
} from "./rin-gates-options-ledger.ts";

const OPTIONS_LEDGER_MARKDOWN = `# Options ledger

## Point: storage

Where records persist.

### Candidate A — Flat files
- **Premises:** GR-3, \`IM-1\`

### Candidate B — SQLite
- **Premises:** none — no external surface

### Candidate C — Remote store
- **Premises:** the vendor API

### Candidate D — Silent

### Decision
- **Chosen:** B
- **Rejected A:** loses data on crash
- **Rejected C:**
- **Rejected D:** no durability

## Point: \`identity\`

### Candidate E — Email
- **Premises:** **TR-1**

### Decision
- **Chosen:** E or F

## Comparison

B wins on durability.
`;

describe("parseOptionsLedger", () => {
  test("reads each point's candidates, premises, chosen line and rejections", () => {
    expect(
      parseOptionsLedger({ markdownText: OPTIONS_LEDGER_MARKDOWN }),
    ).toEqual({
      points: [
        {
          name: "storage",
          lineNumber: 3,
          candidates: [
            {
              letter: "A",
              name: "Flat files",
              lineNumber: 7,
              premises: { kind: "keys", keys: ["GR-3", "IM-1"] },
            },
            {
              letter: "B",
              name: "SQLite",
              lineNumber: 10,
              premises: { kind: "none", reason: "no external surface" },
            },
            {
              letter: "C",
              name: "Remote store",
              lineNumber: 13,
              premises: {
                kind: "malformed",
                text: "the vendor API",
                lineNumber: 14,
              },
            },
            {
              letter: "D",
              name: "Silent",
              lineNumber: 16,
              premises: { kind: "missing" },
            },
          ],
          chosenLine: {
            kind: "resolved",
            candidate: {
              letter: "B",
              name: "SQLite",
              lineNumber: 10,
              premises: { kind: "none", reason: "no external surface" },
            },
            lineNumber: 19,
          },
          rejections: [
            {
              letter: "A",
              reason: { kind: "stated", text: "loses data on crash" },
              lineNumber: 20,
            },
            { letter: "C", reason: { kind: "unstated" }, lineNumber: 21 },
            {
              letter: "D",
              reason: { kind: "stated", text: "no durability" },
              lineNumber: 22,
            },
          ],
        },
        {
          name: "identity",
          lineNumber: 24,
          candidates: [
            {
              letter: "E",
              name: "Email",
              lineNumber: 26,
              premises: { kind: "keys", keys: ["TR-1"] },
            },
          ],
          chosenLine: { kind: "malformed", text: "E or F", lineNumber: 30 },
          rejections: [],
        },
      ],
    });
  });

  test("reads a ledger with no point sections as no points", () => {
    expect(
      parseOptionsLedger({ markdownText: "# Ledger\n\n## Comparison\n" }),
    ).toEqual({ points: [] });
  });

  test("reads a second Chosen line and a second Premises line as malformed, never taking the first", () => {
    expect(
      parseOptionsLedger({
        markdownText:
          "## Point: cache\n### Candidate A — Memory\n- **Premises:** GR-3\n- **Premises:** TR-1\n### Candidate B — Disk\n- **Premises:** none — local\n- **Chosen:** A\n- **Chosen:** B\n",
      }),
    ).toEqual({
      points: [
        {
          name: "cache",
          lineNumber: 1,
          candidates: [
            {
              letter: "A",
              name: "Memory",
              lineNumber: 2,
              premises: {
                kind: "malformed",
                text: "more than one Premises line",
                lineNumber: 4,
              },
            },
            {
              letter: "B",
              name: "Disk",
              lineNumber: 5,
              premises: { kind: "none", reason: "local" },
            },
          ],
          chosenLine: {
            kind: "malformed",
            text: "more than one Chosen line",
            lineNumber: 8,
          },
          rejections: [],
        },
      ],
    });
  });

  test("reads a Chosen letter that names none of the point's candidates as not a candidate", () => {
    expect(
      parseOptionsLedger({
        markdownText:
          "## Point: cache\n### Candidate A — Memory\n- **Premises:** GR-3\n- **Chosen:** Z\n",
      }),
    ).toEqual({
      points: [
        {
          name: "cache",
          lineNumber: 1,
          candidates: [
            {
              letter: "A",
              name: "Memory",
              lineNumber: 2,
              premises: { kind: "keys", keys: ["GR-3"] },
            },
          ],
          chosenLine: { kind: "not-a-candidate", letter: "Z", lineNumber: 4 },
          rejections: [],
        },
      ],
    });
  });

  test("reads a Chosen letter that names two of the point's candidates as ambiguous", () => {
    expect(
      parseOptionsLedger({
        markdownText:
          "## Point: cache\n### Candidate A — Memory\n- **Premises:** GR-3\n### Candidate A — Disk\n- **Premises:** TR-1\n- **Chosen:** A\n",
      }),
    ).toEqual({
      points: [
        {
          name: "cache",
          lineNumber: 1,
          candidates: [
            {
              letter: "A",
              name: "Memory",
              lineNumber: 2,
              premises: { kind: "keys", keys: ["GR-3"] },
            },
            {
              letter: "A",
              name: "Disk",
              lineNumber: 4,
              premises: { kind: "keys", keys: ["TR-1"] },
            },
          ],
          chosenLine: { kind: "ambiguous", letter: "A", lineNumber: 6 },
          rejections: [],
        },
      ],
    });
  });

  test("reads a Premises line mixing a key with free text as malformed, never keeping the key alone", () => {
    expect(
      parseOptionsLedger({
        markdownText:
          "## Point: cache\n### Candidate A — Memory\n- **Premises:** TR-1, the vendor API\n",
      }),
    ).toEqual({
      points: [
        {
          name: "cache",
          lineNumber: 1,
          candidates: [
            {
              letter: "A",
              name: "Memory",
              lineNumber: 2,
              premises: {
                kind: "malformed",
                text: "TR-1, the vendor API",
                lineNumber: 3,
              },
            },
          ],
          chosenLine: { kind: "missing" },
          rejections: [],
        },
      ],
    });
  });

  test("reads a point with no Chosen line as missing", () => {
    expect(
      parseOptionsLedger({
        markdownText: "## Point: cache\n### Candidate A — Memory\n",
      }),
    ).toEqual({
      points: [
        {
          name: "cache",
          lineNumber: 1,
          candidates: [
            {
              letter: "A",
              name: "Memory",
              lineNumber: 2,
              premises: { kind: "missing" },
            },
          ],
          chosenLine: { kind: "missing" },
          rejections: [],
        },
      ],
    });
  });
});

const REMOTE_CANDIDATE: LedgerCandidate = {
  letter: "B",
  name: "Remote",
  lineNumber: 4,
  premises: { kind: "keys", keys: ["TR-1", "TR-2"] },
};

const EMAIL_CANDIDATE: LedgerCandidate = {
  letter: "C",
  name: "Email",
  lineNumber: 10,
  premises: { kind: "none", reason: "local" },
};

const CANDIDATE_WITH_UNREADABLE_PREMISES: LedgerCandidate = {
  letter: "A",
  name: "X",
  lineNumber: 2,
  premises: { kind: "malformed", text: "vendor docs", lineNumber: 3 },
};

const STORAGE_POINT_WITH_TWO_KEYS: DecisionPoint = {
  name: "storage",
  lineNumber: 1,
  candidates: [
    {
      letter: "A",
      name: "Flat files",
      lineNumber: 2,
      premises: { kind: "keys", keys: ["GR-3"] },
    },
    REMOTE_CANDIDATE,
  ],
  chosenLine: { kind: "resolved", candidate: REMOTE_CANDIDATE, lineNumber: 6 },
  rejections: [
    {
      letter: "A",
      reason: { kind: "stated", text: "loses data" },
      lineNumber: 7,
    },
  ],
};

describe("chosenPremisesOf", () => {
  test("returns each point's chosen candidate's premise keys, or none", () => {
    expect(
      chosenPremisesOf({
        ledger: {
          points: [
            STORAGE_POINT_WITH_TWO_KEYS,
            {
              name: "identity",
              lineNumber: 9,
              candidates: [EMAIL_CANDIDATE],
              chosenLine: {
                kind: "resolved",
                candidate: EMAIL_CANDIDATE,
                lineNumber: 12,
              },
              rejections: [],
            },
          ],
        },
      }),
    ).toEqual([
      { kind: "keys", pointName: "storage", keys: ["TR-1", "TR-2"] },
      { kind: "none", pointName: "identity" },
    ]);
  });

  test("reports a point with no readable Chosen line as unreadable", () => {
    expect(
      chosenPremisesOf({
        ledger: {
          points: [
            {
              name: "storage",
              lineNumber: 1,
              candidates: [],
              chosenLine: { kind: "malformed", text: "A?", lineNumber: 4 },
              rejections: [],
            },
          ],
        },
      }),
    ).toEqual([
      {
        kind: "unreadable",
        pointName: "storage",
        reason: "it has no readable Chosen line",
      },
    ]);
  });

  test("reports a Chosen letter naming two candidates as unreadable", () => {
    expect(
      chosenPremisesOf({
        ledger: {
          points: [
            {
              name: "storage",
              lineNumber: 1,
              candidates: [],
              chosenLine: { kind: "ambiguous", letter: "A", lineNumber: 6 },
              rejections: [],
            },
          ],
        },
      }),
    ).toEqual([
      {
        kind: "unreadable",
        pointName: "storage",
        reason:
          "its Chosen letter A does not name exactly one of its candidates",
      },
    ]);
  });

  test("reports a Chosen letter naming none of the candidates as unreadable", () => {
    expect(
      chosenPremisesOf({
        ledger: {
          points: [
            {
              name: "storage",
              lineNumber: 1,
              candidates: [],
              chosenLine: {
                kind: "not-a-candidate",
                letter: "A",
                lineNumber: 6,
              },
              rejections: [],
            },
          ],
        },
      }),
    ).toEqual([
      {
        kind: "unreadable",
        pointName: "storage",
        reason:
          "its Chosen letter A does not name exactly one of its candidates",
      },
    ]);
  });

  test("reports a chosen candidate with no readable Premises line as unreadable", () => {
    expect(
      chosenPremisesOf({
        ledger: {
          points: [
            {
              name: "storage",
              lineNumber: 1,
              candidates: [CANDIDATE_WITH_UNREADABLE_PREMISES],
              chosenLine: {
                kind: "resolved",
                candidate: CANDIDATE_WITH_UNREADABLE_PREMISES,
                lineNumber: 4,
              },
              rejections: [],
            },
          ],
        },
      }),
    ).toEqual([
      {
        kind: "unreadable",
        pointName: "storage",
        reason: "its chosen candidate A has no readable Premises line",
      },
    ]);
  });
});
