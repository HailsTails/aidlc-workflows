import { type FactRow, factKeyOf } from "./rin-gates-fact-rows.ts";
import {
  markdownLinesOf,
  proseOf,
  sectionsAtLevel,
} from "./rin-gates-markdown-lines.ts";
import {
  type ChosenPremises,
  chosenPremisesOf,
  type OptionsLedger,
} from "./rin-gates-options-ledger.ts";
import { FACTS_FILE, OPTIONS_LEDGER_FILE } from "./rin-gates-record-paths.ts";
import {
  type SensorFinding,
  WHOLE_ARTEFACT_LOCATION,
} from "./rin-gates-sensor-report.ts";

const LOCK_FILE = "rin-interface-lock.md";
const EXTERNAL_REALITY_TITLE = "External reality";
const MEASURED_PREMISE_CHECK = "measured-contracts/chosen-premise";
const REALITY_ENTRY = /^\s*[-*]\s+(\S+)\s+[—–-]\s+/;

const externalRealityKeysOf = ({
  lockText,
}: {
  readonly lockText: string;
}): ReadonlySet<string> =>
  new Set(
    sectionsAtLevel({
      lines: markdownLinesOf({ markdownText: lockText }),
      level: 2,
    })
      .filter((section) => section.title === EXTERNAL_REALITY_TITLE)
      .flatMap((section) =>
        proseOf({ lines: section.sectionLines }).flatMap((proseLine) => {
          const key = factKeyOf({
            token: proseLine.text.match(REALITY_ENTRY)?.[1] ?? "",
          });
          return key === undefined ? [] : [key];
        }),
      ),
  );

const premiseFinding = ({
  artefact,
  subject,
  remedy,
}: {
  readonly artefact: string;
  readonly subject: string;
  readonly remedy: string;
}): SensorFinding => ({
  check: MEASURED_PREMISE_CHECK,
  artefact,
  location: WHOLE_ARTEFACT_LOCATION,
  subject,
  remedy,
});

const unlistedPremiseFindings = ({
  key,
  listedKeys,
}: {
  readonly key: string;
  readonly listedKeys: ReadonlySet<string>;
}): readonly SensorFinding[] => {
  if (listedKeys.has(key)) {
    return [];
  }
  return [
    premiseFinding({
      artefact: LOCK_FILE,
      subject: `chosen premise ${key} is not listed under ## External reality`,
      remedy: `Add \`- ${key} — <what was measured>\` to the lock's ## External reality section.`,
    }),
  ];
};

const statusTextOf = ({ row }: { readonly row: FactRow }): string => {
  switch (row.statusCell.kind) {
    case "stated":
      return row.statusCell.status;
    case "malformed":
      return row.statusCell.text;
  }
};

type PremiseJudgement =
  | { readonly kind: "clean" }
  | { readonly kind: "refused"; readonly remedy: string };

const CLEAN_JUDGEMENT: PremiseJudgement = { kind: "clean" };

const unmeasuredPremiseJudgement = ({
  key,
}: {
  readonly key: string;
}): PremiseJudgement => ({
  kind: "refused",
  remedy: `Measure ${key}: its status becomes exactly live or corrected. A failed premise routes back to Gate 2 by the backward jump.`,
});

const premiseJudgementOf = ({
  key,
  row,
}: {
  readonly key: string;
  readonly row: FactRow;
}): PremiseJudgement => {
  switch (row.statusCell.kind) {
    case "malformed":
      return unmeasuredPremiseJudgement({ key });
    case "stated":
      switch (row.statusCell.status) {
        case "live":
        case "corrected":
          return CLEAN_JUDGEMENT;
        case "withdrawn":
          return {
            kind: "refused",
            remedy: `${key} was withdrawn, so the chosen candidate's premise has failed: route back to Gate 2 by the backward jump.`,
          };
        case "unmeasured":
          return unmeasuredPremiseJudgement({ key });
      }
  }
};

const rowStatusFindings = ({
  key,
  row,
}: {
  readonly key: string;
  readonly row: FactRow;
}): readonly SensorFinding[] => {
  const judgement = premiseJudgementOf({ key, row });
  switch (judgement.kind) {
    case "clean":
      return [];
    case "refused":
      return [
        premiseFinding({
          artefact: FACTS_FILE,
          subject: `chosen premise ${key} has status "${statusTextOf({ row })}" at line ${row.lineNumber}`,
          remedy: judgement.remedy,
        }),
      ];
  }
};

const factStatusFindings = ({
  key,
  factRows,
}: {
  readonly key: string;
  readonly factRows: readonly FactRow[];
}): readonly SensorFinding[] => {
  const rowsForKey = factRows.filter((row) => row.key === key);
  if (rowsForKey.length === 0) {
    return [
      premiseFinding({
        artefact: FACTS_FILE,
        subject: `chosen premise ${key} has no facts.md row`,
        remedy: `Add ${key}'s row to facts.md with the claim, the measured value, and status live or corrected.`,
      }),
    ];
  }
  return rowsForKey.flatMap((row) => rowStatusFindings({ key, row }));
};

const unreadablePointFindings = ({
  chosenPremises,
}: {
  readonly chosenPremises: readonly ChosenPremises[];
}): readonly SensorFinding[] =>
  chosenPremises.flatMap((pointPremises) => {
    if (pointPremises.kind !== "unreadable") {
      return [];
    }
    return [
      premiseFinding({
        artefact: OPTIONS_LEDGER_FILE,
        subject: `the chosen premises of point ${pointPremises.pointName} cannot be read: ${pointPremises.reason}`,
        remedy:
          "Gate 3 measures each point's chosen premises: the ledger must name one chosen candidate per point with a Premises line. A ledger that no longer does routes back to Gate 2 by the backward jump.",
      }),
    ];
  });

const distinctChosenKeysOf = ({
  chosenPremises,
}: {
  readonly chosenPremises: readonly ChosenPremises[];
}): readonly string[] => [
  ...new Set(
    chosenPremises.flatMap((pointPremises) =>
      pointPremises.kind === "keys" ? pointPremises.keys : [],
    ),
  ),
];

const EMPTY_LEDGER_FINDINGS: readonly SensorFinding[] = [
  premiseFinding({
    artefact: OPTIONS_LEDGER_FILE,
    subject: "the options ledger holds no `## Point:` section",
    remedy:
      "Gate 3 measures each point's chosen premises, and this ledger names no point. It routes back to Gate 2 by the backward jump.",
  }),
];

const measuredPremiseFindings = ({
  ledger,
  lockText,
  factRows,
}: {
  readonly ledger: OptionsLedger;
  readonly lockText: string;
  readonly factRows: readonly FactRow[];
}): readonly SensorFinding[] => {
  if (ledger.points.length === 0) {
    return EMPTY_LEDGER_FINDINGS;
  }
  const chosenPremises = chosenPremisesOf({ ledger });
  const listedKeys = externalRealityKeysOf({ lockText });
  return [
    ...unreadablePointFindings({ chosenPremises }),
    ...distinctChosenKeysOf({ chosenPremises }).flatMap((key) => [
      ...unlistedPremiseFindings({ key, listedKeys }),
      ...factStatusFindings({ key, factRows }),
    ]),
  ];
};

export { externalRealityKeysOf, LOCK_FILE, measuredPremiseFindings };
