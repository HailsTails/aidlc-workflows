import { describe, expect, test } from "vitest";
import {
  factKeyOf,
  factRowsFrom,
  factRowsOfDocument,
  factStatusOf,
} from "./rin-gates-fact-rows.ts";

const FACTS_MARKDOWN = `# Facts

| key | claim | value | re-derive | status | corrected-by |
|---|---|---|---|---|---|
| **GR-3** | Lenses in the default roster | 4 | read the roster | live | |
| IM-7 | Records whose files carry a marker \\| alternative | 8 | git grep | corrected | first pass |
| BP-1 | Bunpro lists decks | UNMEASURED | curl | Unmeasured | |
| not a key | ignored | | | | |

\`\`\`text
| **ZZ-9** | inside a fence | 1 | x | live | |
\`\`\`
`;

const REORDERED_COLUMNS_FACTS_MARKDOWN = `| claim | key | status |
|---|---|---|
| **AB-1** | a claim | live |

| key | status | claim |
|---|---|---|
| **AB-2** | withdrawn | second claim |
`;

describe("factRowsFrom", () => {
  test("reads bold and plain keys, escaped pipes, and the status cell parsed against the closed set", () => {
    expect(factRowsFrom({ markdownText: FACTS_MARKDOWN })).toEqual([
      {
        key: "GR-3",
        claim: "Lenses in the default roster",
        statusCell: { kind: "stated", status: "live" },
        lineNumber: 5,
      },
      {
        key: "IM-7",
        claim: "Records whose files carry a marker \\| alternative",
        statusCell: { kind: "stated", status: "corrected" },
        lineNumber: 6,
      },
      {
        key: "BP-1",
        claim: "Bunpro lists decks",
        statusCell: { kind: "malformed", text: "Unmeasured" },
        lineNumber: 7,
      },
    ]);
  });

  test("follows each table's own header for the claim and status columns", () => {
    expect(
      factRowsFrom({ markdownText: REORDERED_COLUMNS_FACTS_MARKDOWN }),
    ).toEqual([
      {
        key: "AB-2",
        claim: "second claim",
        statusCell: { kind: "stated", status: "withdrawn" },
        lineNumber: 7,
      },
    ]);
  });
});

describe("factRowsOfDocument", () => {
  test("reads an absent facts.md as no rows", () => {
    expect(factRowsOfDocument({ factsDocument: { kind: "absent" } })).toEqual(
      [],
    );
  });

  test("reads a present facts.md's rows", () => {
    expect(
      factRowsOfDocument({
        factsDocument: {
          kind: "present",
          text: "| key | claim | status |\n|---|---|---|\n| TR-1 | pages | live |\n",
        },
      }),
    ).toEqual([
      {
        key: "TR-1",
        claim: "pages",
        statusCell: { kind: "stated", status: "live" },
        lineNumber: 3,
      },
    ]);
  });
});

describe("factKeyOf", () => {
  test.each([
    ["GR-3", "GR-3"],
    ["**GR-3**", "GR-3"],
    ["`TR-12`", "TR-12"],
    [" **`IMX-7`** ", "IMX-7"],
  ] as const)("reads %j as %s", (token, key) => {
    expect(factKeyOf({ token })).toBe(key);
  });

  test.each([
    "IM2-7",
    "gr-3",
    "GR3",
    "GR-",
    "key",
    "GR-3a",
    "",
  ])("reads %j as no key", (token) => {
    expect(factKeyOf({ token })).toBeUndefined();
  });
});

describe("factStatusOf", () => {
  test.each([
    ["live", "live"],
    ["`corrected`", "corrected"],
    ["**withdrawn**", "withdrawn"],
    ["unmeasured.", "unmeasured"],
  ] as const)("reads %s as %s", (cell, status) => {
    expect(factStatusOf({ cell })).toEqual({ kind: "stated", status: status });
  });

  test.each([
    "live (probe pending)",
    "live — re-measured",
    "corrected by GR-4",
    "Live",
    "livee",
    "",
  ])("refuses the near-miss %j as malformed", (cell) => {
    expect(factStatusOf({ cell })).toEqual({ kind: "malformed", text: cell });
  });
});
