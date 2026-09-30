import type {
  DecisionPoint,
  LedgerCandidate,
  OptionsLedger,
} from "./rin-gates-options-ledger.ts";
import { OPTIONS_LEDGER_FILE } from "./rin-gates-record-paths.ts";
import {
  lineLocation,
  type SensorFinding,
  WHOLE_ARTEFACT_LOCATION,
} from "./rin-gates-sensor-report.ts";

const MINIMUM_CANDIDATES = 2;
const LEDGER_CHECK = "solution-options/ledger";

const ledgerFinding = ({
  lineNumber,
  subject,
  remedy,
}: {
  readonly lineNumber: number;
  readonly subject: string;
  readonly remedy: string;
}): SensorFinding => ({
  check: LEDGER_CHECK,
  artefact: OPTIONS_LEDGER_FILE,
  location: lineLocation({ lineNumber }),
  subject,
  remedy,
});

const ABSENT_LEDGER_FINDINGS: readonly SensorFinding[] = [
  {
    check: LEDGER_CHECK,
    artefact: OPTIONS_LEDGER_FILE,
    location: WHOLE_ARTEFACT_LOCATION,
    subject: `${OPTIONS_LEDGER_FILE} is absent`,
    remedy:
      "Gate 2 writes the options ledger: its decision points, candidates, and the decision on each.",
  },
];

const premiseFindings = ({
  point,
  candidate,
}: {
  readonly point: DecisionPoint;
  readonly candidate: LedgerCandidate;
}): readonly SensorFinding[] => {
  switch (candidate.premises.kind) {
    case "keys":
    case "none":
      return [];
    case "missing":
      return [
        ledgerFinding({
          lineNumber: candidate.lineNumber,
          subject: `Point ${point.name}, candidate ${candidate.letter}: no Premises line`,
          remedy:
            "Add `- **Premises:** <KEY>, <KEY>` naming its facts.md rows, or `- **Premises:** none — <reason>`.",
        }),
      ];
    case "malformed":
      return [
        ledgerFinding({
          lineNumber: candidate.premises.lineNumber,
          subject: `Point ${point.name}, candidate ${candidate.letter}: Premises reads "${candidate.premises.text}"`,
          remedy:
            "List facts.md keys (uppercase letters, a hyphen, then digits, e.g. `OT-1`) separated by commas, or write `none — <reason>`.",
        }),
      ];
  }
};

const repeatedLetterFindings = ({
  point,
}: {
  readonly point: DecisionPoint;
}): readonly SensorFinding[] =>
  point.candidates
    .filter(
      (candidate, index) =>
        point.candidates.findIndex(
          (earlierCandidate) => earlierCandidate.letter === candidate.letter,
        ) !== index,
    )
    .map((candidate) =>
      ledgerFinding({
        lineNumber: candidate.lineNumber,
        subject: `Point ${point.name} lists candidate ${candidate.letter} twice`,
        remedy:
          "A letter names one candidate within its point: give this candidate the next unused letter.",
      }),
    );

const candidateCountFindings = ({
  point,
}: {
  readonly point: DecisionPoint;
}): readonly SensorFinding[] => {
  const distinctLetters = new Set(
    point.candidates.map((candidate) => candidate.letter),
  );
  if (distinctLetters.size >= MINIMUM_CANDIDATES) {
    return [];
  }
  return [
    ledgerFinding({
      lineNumber: point.lineNumber,
      subject: `Point ${point.name} has ${distinctLetters.size} distinct candidate(s)`,
      remedy: `A decision point compares at least ${MINIMUM_CANDIDATES} genuinely different candidates; whether a third was needed is the board's judgement.`,
    }),
  ];
};

const chosenFindings = ({
  point,
}: {
  readonly point: DecisionPoint;
}): readonly SensorFinding[] => {
  const chosenLine = point.chosenLine;
  switch (chosenLine.kind) {
    case "missing":
      return [
        ledgerFinding({
          lineNumber: point.lineNumber,
          subject: `Point ${point.name} has no Chosen line`,
          remedy: "Add `- **Chosen:** <letter>` under the point.",
        }),
      ];
    case "malformed":
      return [
        ledgerFinding({
          lineNumber: chosenLine.lineNumber,
          subject: `Point ${point.name}: Chosen reads "${chosenLine.text}"`,
          remedy: "Write the Chosen line as `- **Chosen:** <letter>`.",
        }),
      ];
    case "not-a-candidate":
      return [
        ledgerFinding({
          lineNumber: chosenLine.lineNumber,
          subject: `Point ${point.name} chose ${chosenLine.letter}, which is not one of its candidates`,
          remedy: "Choose one of the point's own candidate letters.",
        }),
      ];
    case "ambiguous":
      return [
        ledgerFinding({
          lineNumber: chosenLine.lineNumber,
          subject: `Point ${point.name} chose ${chosenLine.letter}, which names more than one of its candidates`,
          remedy:
            "Give each candidate its own letter, then choose exactly one of them.",
        }),
      ];
    case "resolved":
      return [];
  }
};

const unreasonedRejectionFindings = ({
  point,
  chosenCandidate,
}: {
  readonly point: DecisionPoint;
  readonly chosenCandidate: LedgerCandidate;
}): readonly SensorFinding[] => {
  const reasonedLetters = new Set(
    point.rejections
      .filter((rejection) => rejection.reason.kind === "stated")
      .map((rejection) => rejection.letter),
  );
  return point.candidates
    .filter(
      (candidate) =>
        candidate.letter !== chosenCandidate.letter &&
        !reasonedLetters.has(candidate.letter),
    )
    .map((candidate) =>
      ledgerFinding({
        lineNumber: candidate.lineNumber,
        subject: `Point ${point.name} gives no reason for rejecting candidate ${candidate.letter}`,
        remedy: `Add \`- **Rejected ${candidate.letter}:** <reason>\` under the point.`,
      }),
    );
};

const contradictoryRejectionFindings = ({
  point,
  chosenCandidate,
}: {
  readonly point: DecisionPoint;
  readonly chosenCandidate: LedgerCandidate;
}): readonly SensorFinding[] =>
  point.rejections
    .filter((rejection) => rejection.letter === chosenCandidate.letter)
    .map((rejection) =>
      ledgerFinding({
        lineNumber: rejection.lineNumber,
        subject: `Point ${point.name} both chooses and rejects candidate ${rejection.letter}`,
        remedy:
          "Remove the Rejected line for the chosen candidate, or choose a different candidate.",
      }),
    );

const foreignRejectionFindings = ({
  point,
}: {
  readonly point: DecisionPoint;
}): readonly SensorFinding[] => {
  const candidateLetters = new Set(
    point.candidates.map((candidate) => candidate.letter),
  );
  return point.rejections
    .filter((rejection) => !candidateLetters.has(rejection.letter))
    .map((rejection) =>
      ledgerFinding({
        lineNumber: rejection.lineNumber,
        subject: `Point ${point.name} rejects ${rejection.letter}, which is not one of its candidates`,
        remedy: "Reject only the point's own candidate letters.",
      }),
    );
};

const rejectionFindings = ({
  point,
}: {
  readonly point: DecisionPoint;
}): readonly SensorFinding[] => {
  const chosenLine = point.chosenLine;
  if (chosenLine.kind !== "resolved") {
    return foreignRejectionFindings({ point });
  }
  return [
    ...unreasonedRejectionFindings({
      point,
      chosenCandidate: chosenLine.candidate,
    }),
    ...contradictoryRejectionFindings({
      point,
      chosenCandidate: chosenLine.candidate,
    }),
    ...foreignRejectionFindings({ point }),
  ];
};

const pointFindings = ({
  point,
}: {
  readonly point: DecisionPoint;
}): readonly SensorFinding[] => [
  ...candidateCountFindings({ point }),
  ...repeatedLetterFindings({ point }),
  ...point.candidates.flatMap((candidate) =>
    premiseFindings({ point, candidate }),
  ),
  ...chosenFindings({ point }),
  ...rejectionFindings({ point }),
];

const ledgerShapeFindings = ({
  ledger,
}: {
  readonly ledger: OptionsLedger;
}): readonly SensorFinding[] => {
  if (ledger.points.length === 0) {
    return [
      {
        check: LEDGER_CHECK,
        artefact: OPTIONS_LEDGER_FILE,
        location: WHOLE_ARTEFACT_LOCATION,
        subject: "no `## Point: <name>` section",
        remedy:
          "Record each decision point as `## Point: <name>` with its candidates and the decision.",
      },
    ];
  }
  return ledger.points.flatMap((point) => pointFindings({ point }));
};

export { ABSENT_LEDGER_FINDINGS, ledgerShapeFindings };
