import { describe, expect, test } from "vitest";
import type { FactRow } from "./rin-gates-fact-rows.ts";
import {
  externalRealityKeysOf,
  measuredPremiseFindings,
} from "./rin-gates-measured-contracts.ts";
import type {
  LedgerCandidate,
  OptionsLedger,
} from "./rin-gates-options-ledger.ts";

const REMOTE_CANDIDATE: LedgerCandidate = {
  letter: "B",
  name: "Remote",
  lineNumber: 4,
  premises: { kind: "keys", keys: ["TR-1", "TR-2"] },
};

const OPTIONS_LEDGER: OptionsLedger = {
  points: [
    {
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
      chosenLine: {
        kind: "resolved",
        candidate: REMOTE_CANDIDATE,
        lineNumber: 6,
      },
      rejections: [
        {
          letter: "A",
          reason: { kind: "stated", text: "loses data" },
          lineNumber: 7,
        },
      ],
    },
  ],
};

const INTERFACE_LOCK_MARKDOWN = `# Lock

### save
- **State:** specified

## External reality

- TR-1 — holds
- **TR-2** — holds
`;

const INTERFACE_LOCK_WITHOUT_TR2_MARKDOWN = `# Lock

### save
- **State:** specified

## External reality

- TR-1 — holds
`;

const TR1_LIVE: FactRow = {
  key: "TR-1",
  claim: "the API pages",
  statusCell: { kind: "stated", status: "live" },
  lineNumber: 3,
};

const TR2_CORRECTED: FactRow = {
  key: "TR-2",
  claim: "the API is idempotent",
  statusCell: { kind: "stated", status: "corrected" },
  lineNumber: 4,
};

const TR2_LIVE: FactRow = {
  key: "TR-2",
  claim: "the API is idempotent",
  statusCell: { kind: "stated", status: "live" },
  lineNumber: 6,
};

const TR2_WITHDRAWN: FactRow = {
  key: "TR-2",
  claim: "the API is idempotent",
  statusCell: { kind: "stated", status: "withdrawn" },
  lineNumber: 4,
};

const TR2_HEDGED: FactRow = {
  key: "TR-2",
  claim: "the API is idempotent",
  statusCell: { kind: "malformed", text: "live (probe pending)" },
  lineNumber: 4,
};

const TR2_UNMEASURED: FactRow = {
  key: "TR-2",
  claim: "the API is idempotent",
  statusCell: { kind: "stated", status: "unmeasured" },
  lineNumber: 4,
};

const GR3_UNMEASURED: FactRow = {
  key: "GR-3",
  claim: "unchosen",
  statusCell: { kind: "stated", status: "unmeasured" },
  lineNumber: 5,
};

describe("externalRealityKeysOf", () => {
  test("reads the keys of the External reality entries only", () => {
    expect(
      externalRealityKeysOf({
        lockText: `- XX-9 — measured\n\n## External reality\n\n- TR-1 — holds\n- none — no surface\n\n## Constitution Check\n\n- CD-2 — clean\n`,
      }),
    ).toEqual(new Set(["TR-1"]));
  });
});

describe("measuredPremiseFindings", () => {
  test("accepts chosen premises listed and with status live or corrected", () => {
    expect(
      measuredPremiseFindings({
        ledger: OPTIONS_LEDGER,
        lockText: INTERFACE_LOCK_MARKDOWN,
        factRows: [TR1_LIVE, TR2_CORRECTED, GR3_UNMEASURED],
      }),
    ).toEqual([]);
  });

  test("refuses a chosen premise missing from External reality", () => {
    expect(
      measuredPremiseFindings({
        ledger: OPTIONS_LEDGER,
        lockText: INTERFACE_LOCK_WITHOUT_TR2_MARKDOWN,
        factRows: [TR1_LIVE, TR2_LIVE],
      }),
    ).toEqual([
      {
        check: "measured-contracts/chosen-premise",
        artefact: "rin-interface-lock.md",
        location: { kind: "artefact" },
        subject: "chosen premise TR-2 is not listed under ## External reality",
        remedy:
          "Add `- TR-2 — <what was measured>` to the lock's ## External reality section.",
      },
    ]);
  });

  test("refuses a chosen premise whose status is not exactly live or corrected", () => {
    expect(
      measuredPremiseFindings({
        ledger: OPTIONS_LEDGER,
        lockText: INTERFACE_LOCK_MARKDOWN,
        factRows: [TR1_LIVE, TR2_HEDGED],
      }),
    ).toEqual([
      {
        check: "measured-contracts/chosen-premise",
        artefact: "facts.md",
        location: { kind: "artefact" },
        subject:
          'chosen premise TR-2 has status "live (probe pending)" at line 4',
        remedy:
          "Measure TR-2: its status becomes exactly live or corrected. A failed premise routes back to Gate 2 by the backward jump.",
      },
    ]);
  });

  test("refuses a chosen premise still stated unmeasured", () => {
    expect(
      measuredPremiseFindings({
        ledger: OPTIONS_LEDGER,
        lockText: INTERFACE_LOCK_MARKDOWN,
        factRows: [TR1_LIVE, TR2_UNMEASURED],
      }),
    ).toEqual([
      {
        check: "measured-contracts/chosen-premise",
        artefact: "facts.md",
        location: { kind: "artefact" },
        subject: 'chosen premise TR-2 has status "unmeasured" at line 4',
        remedy:
          "Measure TR-2: its status becomes exactly live or corrected. A failed premise routes back to Gate 2 by the backward jump.",
      },
    ]);
  });

  test("refuses a chosen premise with no facts.md row", () => {
    expect(
      measuredPremiseFindings({
        ledger: OPTIONS_LEDGER,
        lockText: INTERFACE_LOCK_MARKDOWN,
        factRows: [TR2_LIVE],
      }),
    ).toEqual([
      {
        check: "measured-contracts/chosen-premise",
        artefact: "facts.md",
        location: { kind: "artefact" },
        subject: "chosen premise TR-1 has no facts.md row",
        remedy:
          "Add TR-1's row to facts.md with the claim, the measured value, and status live or corrected.",
      },
    ]);
  });

  test("refuses a withdrawn row even when a later row for the key is live", () => {
    expect(
      measuredPremiseFindings({
        ledger: OPTIONS_LEDGER,
        lockText: INTERFACE_LOCK_MARKDOWN,
        factRows: [TR1_LIVE, TR2_WITHDRAWN, TR2_LIVE],
      }),
    ).toEqual([
      {
        check: "measured-contracts/chosen-premise",
        artefact: "facts.md",
        location: { kind: "artefact" },
        subject: 'chosen premise TR-2 has status "withdrawn" at line 4',
        remedy:
          "TR-2 was withdrawn, so the chosen candidate's premise has failed: route back to Gate 2 by the backward jump.",
      },
    ]);
  });

  test("refuses a point whose chosen premises cannot be read, rather than measuring nothing", () => {
    expect(
      measuredPremiseFindings({
        ledger: {
          points: [
            {
              name: "storage",
              lineNumber: 1,
              candidates: [],
              chosenLine: { kind: "missing" },
              rejections: [],
            },
          ],
        },
        lockText: INTERFACE_LOCK_MARKDOWN,
        factRows: [TR1_LIVE],
      }),
    ).toEqual([
      {
        check: "measured-contracts/chosen-premise",
        artefact: "rin-solution-options.md",
        location: { kind: "artefact" },
        subject:
          "the chosen premises of point storage cannot be read: it has no readable Chosen line",
        remedy:
          "Gate 3 measures each point's chosen premises: the ledger must name one chosen candidate per point with a Premises line. A ledger that no longer does routes back to Gate 2 by the backward jump.",
      },
    ]);
  });

  test("refuses a ledger with no decision point, rather than measuring nothing", () => {
    expect(
      measuredPremiseFindings({
        ledger: { points: [] },
        lockText: INTERFACE_LOCK_MARKDOWN,
        factRows: [],
      }),
    ).toEqual([
      {
        check: "measured-contracts/chosen-premise",
        artefact: "rin-solution-options.md",
        location: { kind: "artefact" },
        subject: "the options ledger holds no `## Point:` section",
        remedy:
          "Gate 3 measures each point's chosen premises, and this ledger names no point. It routes back to Gate 2 by the backward jump.",
      },
    ]);
  });
});
