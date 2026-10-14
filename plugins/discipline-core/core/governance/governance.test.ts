import { describe, expect, it } from "vitest";
import type { ExceptionRecord } from "../exception-records/exception-records.ts";
import type { TouchedSet } from "../touched-set/touched-set.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { mechanismIdSchema } from "../values/identifiers.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import type { WhyChain } from "../values/why-chain.ts";
import { applyGovernance, type Finding } from "./governance.ts";

const noClass = clauseAddressSchema.parse("CD-14#no-class-syntax");
const noForOf = clauseAddressSchema.parse("CD-15#no-for-of");
const probeNoClass = clauseAddressSchema.parse("probe/CD-14#no-class-syntax");
const fileA = repoPathSchema.parse("src/a.ts");
const fileB = repoPathSchema.parse("src/b.ts");
const packageJson = repoPathSchema.parse("package.json");
const suppressions = repoPathSchema.parse("eslint-suppressions.json");
const walker = mechanismIdSchema.parse("walker");
const eslint = mechanismIdSchema.parse("eslint");

const why = {
  why: "Why does this file declare a class?",
  because: "The vendored parser exports a class the adapter must extend",
  evidence: "vendor/parser/index.d.ts line 12",
};

const whyChain: WhyChain = {
  whys: [why, why, why, why, why],
  rootCause: "The vendored parser's extension point is class-based",
  owner: "260926-vendor-divergence-untrac",
};

const noClassInA: Finding = {
  clause: noClass,
  file: fileA,
  anchor: { line: 3, column: 5 },
  snippet: "class A {}",
  mechanism: walker,
};

const noClassInB: Finding = {
  clause: noClass,
  file: fileB,
  anchor: { line: 8, column: 1 },
  snippet: "class B {}",
  mechanism: walker,
};

const locatedNoClassInA: ExceptionRecord = {
  kind: "authorised-location",
  clause: noClass,
  mechanism: walker,
  file: fileA,
  reason: "the adapter factory wraps the parser's class",
};

const carvedNoClassInA: ExceptionRecord = {
  kind: "file-carve-out",
  clause: noClass,
  mechanism: walker,
  file: fileA,
  reason: "the parser adapter is unpaid debt",
  whyChain,
};

const carvedNoClassEverywhere: ExceptionRecord = {
  kind: "clause-wide-carve-out",
  clause: noClass,
  mechanism: walker,
  reason: "the whole clause is unpaid debt",
  whyChain,
};

const locatedNoForOfInA: ExceptionRecord = {
  kind: "authorised-location",
  clause: noForOf,
  mechanism: walker,
  file: fileA,
  reason: "the stream drain is an authorised site",
};

const carvedProbeNoClassInA: ExceptionRecord = {
  kind: "file-carve-out",
  clause: probeNoClass,
  mechanism: walker,
  file: fileA,
  reason: "the probe rule set's debt",
  whyChain,
};

const nothingTouched: TouchedSet = { measured: "yes", paths: new Set() };
const fileATouched: TouchedSet = { measured: "yes", paths: new Set([fileA]) };
const unmeasured: TouchedSet = {
  measured: "no",
  reason: "no-base-revision",
  detail: "no base revision was given",
};

const quietWalker = { mechanism: walker, nativeExceptions: [], projectedKinds: [] };

const nothingGoverned = {
  findings: [],
  exempted: [],
  stale: [],
  forfeited: [],
  doublyHeld: [],
  unrecorded: [],
};

describe("applyGovernance with no records", () => {
  it("keeps every finding and lists nothing else", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [],
        touched: nothingTouched,
        runs: [quietWalker],
      }),
    ).toEqual({ ...nothingGoverned, findings: [noClassInA] });
  });
});

describe("applyGovernance rule 3, exempt", () => {
  it("exempts a finding whose clause and file an authorised location names, and leaves it out of findings", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [locatedNoClassInA],
        touched: nothingTouched,
        runs: [quietWalker],
      }),
    ).toEqual({
      ...nothingGoverned,
      exempted: [{ finding: noClassInA, by: [locatedNoClassInA] }],
    });
  });

  it("exempts a finding whose clause and file an untouched file carve-out names", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [carvedNoClassInA],
        touched: nothingTouched,
        runs: [quietWalker],
      }),
    ).toEqual({
      ...nothingGoverned,
      exempted: [{ finding: noClassInA, by: [carvedNoClassInA] }],
    });
  });

  it("exempts a finding in any file whose clause a clause-wide carve-out names", () => {
    expect(
      applyGovernance({
        findings: [noClassInA, noClassInB],
        records: [carvedNoClassEverywhere],
        touched: nothingTouched,
        runs: [quietWalker],
      }),
    ).toEqual({
      ...nothingGoverned,
      exempted: [
        { finding: noClassInA, by: [carvedNoClassEverywhere] },
        { finding: noClassInB, by: [carvedNoClassEverywhere] },
      ],
    });
  });

  it("credits every record that names the finding, in the records' order", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [carvedNoClassEverywhere, carvedNoClassInA],
        touched: nothingTouched,
        runs: [quietWalker],
      }).exempted,
    ).toEqual([{ finding: noClassInA, by: [carvedNoClassEverywhere, carvedNoClassInA] }]);
  });

  it("does not exempt a finding in a file the record does not name", () => {
    expect(
      applyGovernance({
        findings: [noClassInB],
        records: [locatedNoClassInA],
        touched: nothingTouched,
        runs: [quietWalker],
      }).findings,
    ).toEqual([noClassInB]);
  });

  it("does not exempt a finding of a clause the record does not name", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [locatedNoForOfInA],
        touched: nothingTouched,
        runs: [quietWalker],
      }).findings,
    ).toEqual([noClassInA]);
  });

  it("does not exempt a shared clause's finding by a named rule set's record of the same discipline and clause", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [carvedProbeNoClassInA],
        touched: nothingTouched,
        runs: [quietWalker],
      }).findings,
    ).toEqual([noClassInA]);
  });
});

describe("applyGovernance rule 1, forfeit", () => {
  it("forfeits a file carve-out whose file was touched, and it exempts nothing", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [carvedNoClassInA],
        touched: fileATouched,
        runs: [quietWalker],
      }),
    ).toEqual({
      ...nothingGoverned,
      findings: [noClassInA],
      forfeited: [carvedNoClassInA],
    });
  });

  it("does not forfeit an authorised location whose file was touched", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [locatedNoClassInA],
        touched: fileATouched,
        runs: [quietWalker],
      }),
    ).toEqual({
      ...nothingGoverned,
      exempted: [{ finding: noClassInA, by: [locatedNoClassInA] }],
    });
  });

  it("does not forfeit a clause-wide carve-out when a file it covers was touched", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [carvedNoClassEverywhere],
        touched: fileATouched,
        runs: [quietWalker],
      }),
    ).toEqual({
      ...nothingGoverned,
      exempted: [{ finding: noClassInA, by: [carvedNoClassEverywhere] }],
    });
  });

  it("forfeits nothing when the touched set is unmeasured, so the file carve-out still exempts", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [carvedNoClassInA],
        touched: unmeasured,
        runs: [quietWalker],
      }),
    ).toEqual({
      ...nothingGoverned,
      exempted: [{ finding: noClassInA, by: [carvedNoClassInA] }],
    });
  });
});

describe("applyGovernance rule 2, doubly held", () => {
  it("lists a clause and file held by both an authorised location and a file carve-out, and neither exempts", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [locatedNoClassInA, carvedNoClassInA],
        touched: nothingTouched,
        runs: [quietWalker],
      }),
    ).toEqual({
      ...nothingGoverned,
      findings: [noClassInA],
      doublyHeld: [{ clause: noClass, file: fileA, mechanism: walker }],
    });
  });

  it("lists a doubly-held clause and file that no finding hits", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [locatedNoClassInA, carvedNoClassInA],
        touched: nothingTouched,
        runs: [quietWalker],
      }),
    ).toEqual({
      ...nothingGoverned,
      doublyHeld: [{ clause: noClass, file: fileA, mechanism: walker }],
    });
  });

  it("does not list a pair whose file carve-out was forfeited, and the authorised location exempts", () => {
    expect(
      applyGovernance({
        findings: [noClassInA],
        records: [locatedNoClassInA, carvedNoClassInA],
        touched: fileATouched,
        runs: [quietWalker],
      }),
    ).toEqual({
      ...nothingGoverned,
      exempted: [{ finding: noClassInA, by: [locatedNoClassInA] }],
      forfeited: [carvedNoClassInA],
    });
  });
});

describe("applyGovernance rule 4, stale", () => {
  it("lists a record in force that is credited for no finding", () => {
    expect(
      applyGovernance({
        findings: [noClassInB],
        records: [locatedNoClassInA],
        touched: nothingTouched,
        runs: [quietWalker],
      }),
    ).toEqual({
      ...nothingGoverned,
      findings: [noClassInB],
      stale: [locatedNoClassInA],
    });
  });

  it("lists an uncredited clause-wide carve-out", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [carvedNoClassEverywhere],
        touched: nothingTouched,
        runs: [quietWalker],
      }).stale,
    ).toEqual([carvedNoClassEverywhere]);
  });

  it("does not list a forfeited record as stale", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [carvedNoClassInA],
        touched: fileATouched,
        runs: [quietWalker],
      }).stale,
    ).toEqual([]);
  });
});

describe("applyGovernance rule 5, unrecorded", () => {
  it("lists nothing when no run reports a native exception", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [],
        touched: nothingTouched,
        runs: [quietWalker, { mechanism: eslint, nativeExceptions: [], projectedKinds: [] }],
      }).unrecorded,
    ).toEqual([]);
  });

  it("records a native exception of a projected kind that an authorised location naming its clause and file matches", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [{ ...locatedNoClassInA, mechanism: eslint }],
        touched: nothingTouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [{ kind: "config-override", clause: noClass, file: fileA }],
            projectedKinds: ["config-override"],
          },
        ],
      }).unrecorded,
    ).toEqual([]);
  });

  it("lists, attributed to its mechanism, a native exception of a kind its run does not project", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [{ ...locatedNoClassInA, mechanism: eslint }],
        touched: nothingTouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [
              {
                kind: "inline-disable",
                clause: noClass,
                file: fileA,
                line: 7,
                text: "// eslint-disable-line no-class",
              },
            ],
            projectedKinds: ["config-override"],
          },
        ],
      }).unrecorded,
    ).toEqual([
      {
        kind: "inline-disable",
        clause: noClass,
        file: fileA,
        line: 7,
        text: "// eslint-disable-line no-class",
        mechanism: eslint,
      },
    ]);
  });

  it("lists a native exception of a projected kind that no record matches", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [],
        touched: nothingTouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [{ kind: "config-override", clause: noClass, file: fileA }],
            projectedKinds: ["config-override"],
          },
        ],
      }).unrecorded,
    ).toEqual([{ kind: "config-override", clause: noClass, file: fileA, mechanism: eslint }]);
  });

  it("lists a native exception whose matching record names another file", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [{ ...locatedNoClassInA, mechanism: eslint }],
        touched: nothingTouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [{ kind: "config-override", clause: noClass, file: fileB }],
            projectedKinds: ["config-override"],
          },
        ],
      }).unrecorded,
    ).toEqual([{ kind: "config-override", clause: noClass, file: fileB, mechanism: eslint }]);
  });

  it("lists a native exception whose kind only another run projects", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [locatedNoClassInA],
        touched: nothingTouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [],
            projectedKinds: ["config-override"],
          },
          {
            mechanism: walker,
            nativeExceptions: [{ kind: "config-override", clause: noClass, file: fileA }],
            projectedKinds: [],
          },
        ],
      }).unrecorded,
    ).toEqual([{ kind: "config-override", clause: noClass, file: fileA, mechanism: walker }]);
  });

  it("records a native exception that a forfeited file carve-out matches", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [{ ...carvedNoClassInA, mechanism: eslint }],
        touched: fileATouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [{ kind: "config-override", clause: noClass, file: fileA }],
            projectedKinds: ["config-override"],
          },
        ],
      }).unrecorded,
    ).toEqual([]);
  });

  it("records a native exception in any file that a clause-wide carve-out matches", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [{ ...carvedNoClassEverywhere, mechanism: eslint }],
        touched: nothingTouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [
              {
                kind: "suppression-entry",
                clause: noClass,
                file: fileB,
                location: suppressions,
              },
            ],
            projectedKinds: ["suppression-entry"],
          },
        ],
      }).unrecorded,
    ).toEqual([]);
  });

  it("lists a projected command-line option that only a file carve-out on its location matches", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [{ ...carvedNoClassInA, mechanism: eslint, file: packageJson }],
        touched: nothingTouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [
              {
                kind: "command-line-option",
                clause: noClass,
                location: packageJson,
                script: "lint",
                option: "--rule no-class:off",
              },
            ],
            projectedKinds: ["command-line-option"],
          },
        ],
      }).unrecorded,
    ).toEqual([
      {
        kind: "command-line-option",
        clause: noClass,
        location: packageJson,
        script: "lint",
        option: "--rule no-class:off",
        mechanism: eslint,
      },
    ]);
  });

  it("records a projected command-line option that a clause-wide carve-out matches", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [{ ...carvedNoClassEverywhere, mechanism: eslint }],
        touched: nothingTouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [
              {
                kind: "command-line-option",
                clause: noClass,
                location: packageJson,
                script: "lint",
                option: "--rule no-class:off",
              },
            ],
            projectedKinds: ["command-line-option"],
          },
        ],
      }).unrecorded,
    ).toEqual([]);
  });

  it("lists a native exception that hides no finding", () => {
    expect(
      applyGovernance({
        findings: [noClassInB],
        records: [],
        touched: nothingTouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [{ kind: "ignore", clause: noClass, file: fileA }],
            projectedKinds: [],
          },
        ],
      }).unrecorded,
    ).toEqual([{ kind: "ignore", clause: noClass, file: fileA, mechanism: eslint }]);
  });
});

describe("applyGovernance rule 5, doubly held", () => {
  it("records a native exception whose clause and file a doubly-held pair names", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [
          { ...locatedNoClassInA, mechanism: eslint },
          { ...carvedNoClassInA, mechanism: eslint },
        ],
        touched: nothingTouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [{ kind: "config-override", clause: noClass, file: fileA }],
            projectedKinds: ["config-override"],
          },
        ],
      }),
    ).toEqual({
      ...nothingGoverned,
      doublyHeld: [{ clause: noClass, file: fileA, mechanism: eslint }],
    });
  });
});

describe("applyGovernance rule 5, mechanism", () => {
  it("lists a native exception whose only matching clause and file record belongs to another mechanism", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [locatedNoClassInA],
        touched: nothingTouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [{ kind: "config-override", clause: noClass, file: fileA }],
            projectedKinds: ["config-override"],
          },
        ],
      }).unrecorded,
    ).toEqual([{ kind: "config-override", clause: noClass, file: fileA, mechanism: eslint }]);
  });
});

describe("applyGovernance order", () => {
  it("keeps stale records in the records' order", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [locatedNoForOfInA, carvedNoClassEverywhere, locatedNoClassInA],
        touched: nothingTouched,
        runs: [quietWalker],
      }).stale,
    ).toEqual([locatedNoForOfInA, carvedNoClassEverywhere, locatedNoClassInA]);
  });

  it("keeps forfeited records in the records' order", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [
          carvedProbeNoClassInA,
          carvedNoClassInA,
        ],
        touched: fileATouched,
        runs: [quietWalker],
      }).forfeited,
    ).toEqual([carvedProbeNoClassInA, carvedNoClassInA]);
  });

  it("keeps doubly-held pairs in the records' order", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [
          locatedNoForOfInA,
          { ...carvedNoClassInA, clause: noForOf },
          locatedNoClassInA,
          carvedNoClassInA,
        ],
        touched: nothingTouched,
        runs: [quietWalker],
      }).doublyHeld,
    ).toEqual([
      { clause: noForOf, file: fileA, mechanism: walker },
      { clause: noClass, file: fileA, mechanism: walker },
    ]);
  });

  it("keeps unrecorded native exceptions in the runs' order, then each run's own order", () => {
    expect(
      applyGovernance({
        findings: [],
        records: [],
        touched: nothingTouched,
        runs: [
          {
            mechanism: eslint,
            nativeExceptions: [
              { kind: "ignore", clause: noClass, file: fileB },
              { kind: "ignore", clause: noClass, file: fileA },
            ],
            projectedKinds: [],
          },
          {
            mechanism: walker,
            nativeExceptions: [{ kind: "ignore", clause: noForOf, file: fileA }],
            projectedKinds: [],
          },
        ],
      }).unrecorded,
    ).toEqual([
      { kind: "ignore", clause: noClass, file: fileB, mechanism: eslint },
      { kind: "ignore", clause: noClass, file: fileA, mechanism: eslint },
      { kind: "ignore", clause: noForOf, file: fileA, mechanism: walker },
    ]);
  });
});
