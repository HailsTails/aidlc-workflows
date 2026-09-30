import { factKeyOf } from "./rin-gates-fact-rows.ts";
import {
  type HeadingSection,
  type MarkdownLine,
  markdownLinesOf,
  proseOf,
  sectionsAtLevel,
  statedTokenOf,
} from "./rin-gates-markdown-lines.ts";

type PremiseLine =
  | { readonly kind: "keys"; readonly keys: readonly string[] }
  | { readonly kind: "none"; readonly reason: string }
  | {
      readonly kind: "malformed";
      readonly text: string;
      readonly lineNumber: number;
    }
  | { readonly kind: "missing" };

type LedgerCandidate = {
  readonly letter: string;
  readonly name: string;
  readonly lineNumber: number;
  readonly premises: PremiseLine;
};

type ChosenLine =
  | {
      readonly kind: "resolved";
      readonly candidate: LedgerCandidate;
      readonly lineNumber: number;
    }
  | {
      readonly kind: "not-a-candidate";
      readonly letter: string;
      readonly lineNumber: number;
    }
  | {
      readonly kind: "ambiguous";
      readonly letter: string;
      readonly lineNumber: number;
    }
  | {
      readonly kind: "malformed";
      readonly text: string;
      readonly lineNumber: number;
    }
  | { readonly kind: "missing" };

type RejectionReason =
  | { readonly kind: "stated"; readonly text: string }
  | { readonly kind: "unstated" };

type Rejection = {
  readonly letter: string;
  readonly reason: RejectionReason;
  readonly lineNumber: number;
};

type DecisionPoint = {
  readonly name: string;
  readonly lineNumber: number;
  readonly candidates: readonly LedgerCandidate[];
  readonly chosenLine: ChosenLine;
  readonly rejections: readonly Rejection[];
};

type OptionsLedger = {
  readonly points: readonly DecisionPoint[];
};

type ChosenPremises =
  | {
      readonly kind: "keys";
      readonly pointName: string;
      readonly keys: readonly string[];
    }
  | { readonly kind: "none"; readonly pointName: string }
  | {
      readonly kind: "unreadable";
      readonly pointName: string;
      readonly reason: string;
    };

const POINT_HEADING = /^Point:\s*(\S.*)$/;
const CANDIDATE_HEADING = /^Candidate\s+([A-Z]+)\s+[—–-]\s+(\S.*)$/;
const LETTER = /^[A-Z]+$/;
const PREMISES_LINE = /^\s*[-*]\s+\*\*Premises(?::\*\*|\*\*:)\s*(.*)$/;
const CHOSEN_LINE = /^\s*[-*]\s+\*\*Chosen(?::\*\*|\*\*:)\s*(.*)$/;
const REJECTED_LINE =
  /^\s*[-*]\s+\*\*Rejected\s+([A-Z]+)(?::\*\*|\*\*:)\s*(.*)$/;
const NONE_PREMISE = /^none\s+[—–-]\s+(\S.*)$/;

const premisesOf = ({
  sectionLines,
}: {
  readonly sectionLines: readonly MarkdownLine[];
}): PremiseLine => {
  const premisesMarkdownLines = proseOf({ lines: sectionLines }).filter(
    (proseLine) => PREMISES_LINE.test(proseLine.text),
  );
  const [premisesMarkdownLine, secondPremisesMarkdownLine] =
    premisesMarkdownLines;
  if (premisesMarkdownLine === undefined) {
    return { kind: "missing" };
  }
  if (secondPremisesMarkdownLine !== undefined) {
    return {
      kind: "malformed",
      text: "more than one Premises line",
      lineNumber: secondPremisesMarkdownLine.lineNumber,
    };
  }
  const premisesText = (
    premisesMarkdownLine.text.match(PREMISES_LINE)?.[1] ?? ""
  ).trim();
  const noneReason = premisesText.match(NONE_PREMISE)?.[1];
  if (noneReason !== undefined) {
    return { kind: "none", reason: noneReason };
  }
  const premiseTokens = premisesText.split(",");
  const keys = premiseTokens.flatMap((token) => {
    const key = factKeyOf({ token });
    return key === undefined ? [] : [key];
  });
  if (keys.length === 0 || keys.length !== premiseTokens.length) {
    return {
      kind: "malformed",
      text: premisesText,
      lineNumber: premisesMarkdownLine.lineNumber,
    };
  }
  return { kind: "keys", keys };
};

const candidatesOf = ({
  pointLines,
}: {
  readonly pointLines: readonly MarkdownLine[];
}): readonly LedgerCandidate[] =>
  sectionsAtLevel({ lines: pointLines, level: 3 }).flatMap((section) => {
    const headingMatch = section.title.match(CANDIDATE_HEADING);
    const letter = headingMatch?.[1];
    if (letter === undefined) {
      return [];
    }
    return [
      {
        letter,
        name: headingMatch?.[2] ?? "",
        lineNumber: section.headingLineNumber,
        premises: premisesOf({ sectionLines: section.sectionLines }),
      },
    ];
  });

const chosenLineForLetter = ({
  letter,
  lineNumber,
  candidates,
}: {
  readonly letter: string;
  readonly lineNumber: number;
  readonly candidates: readonly LedgerCandidate[];
}): ChosenLine => {
  const candidatesWithLetter = candidates.filter(
    (candidate) => candidate.letter === letter,
  );
  const [candidate, secondCandidate] = candidatesWithLetter;
  if (candidate === undefined) {
    return { kind: "not-a-candidate", letter, lineNumber };
  }
  if (secondCandidate !== undefined) {
    return { kind: "ambiguous", letter, lineNumber };
  }
  return { kind: "resolved", candidate, lineNumber };
};

const chosenLineOf = ({
  pointLines,
  candidates,
}: {
  readonly pointLines: readonly MarkdownLine[];
  readonly candidates: readonly LedgerCandidate[];
}): ChosenLine => {
  const chosenMarkdownLines = proseOf({ lines: pointLines }).filter(
    (proseLine) => CHOSEN_LINE.test(proseLine.text),
  );
  const [chosenMarkdownLine, secondChosenMarkdownLine] = chosenMarkdownLines;
  if (chosenMarkdownLine === undefined) {
    return { kind: "missing" };
  }
  if (secondChosenMarkdownLine !== undefined) {
    return {
      kind: "malformed",
      text: "more than one Chosen line",
      lineNumber: secondChosenMarkdownLine.lineNumber,
    };
  }
  const chosenText = (
    chosenMarkdownLine.text.match(CHOSEN_LINE)?.[1] ?? ""
  ).trim();
  const letter = statedTokenOf({ text: chosenText });
  if (!LETTER.test(letter)) {
    return {
      kind: "malformed",
      text: chosenText,
      lineNumber: chosenMarkdownLine.lineNumber,
    };
  }
  return chosenLineForLetter({
    letter,
    lineNumber: chosenMarkdownLine.lineNumber,
    candidates,
  });
};

const rejectionReasonOf = ({
  text,
}: {
  readonly text: string;
}): RejectionReason => {
  const trimmedText = text.trim();
  if (trimmedText.length === 0) {
    return { kind: "unstated" };
  }
  return { kind: "stated", text: trimmedText };
};

const rejectionsOf = ({
  pointLines,
}: {
  readonly pointLines: readonly MarkdownLine[];
}): readonly Rejection[] =>
  proseOf({ lines: pointLines }).flatMap((proseLine) => {
    const rejectedLineMatch = proseLine.text.match(REJECTED_LINE);
    const letter = rejectedLineMatch?.[1];
    if (letter === undefined) {
      return [];
    }
    return [
      {
        letter,
        reason: rejectionReasonOf({ text: rejectedLineMatch?.[2] ?? "" }),
        lineNumber: proseLine.lineNumber,
      },
    ];
  });

const decisionPointsOfSection = ({
  section,
}: {
  readonly section: HeadingSection;
}): readonly DecisionPoint[] => {
  const pointName = section.title.match(POINT_HEADING)?.[1];
  if (pointName === undefined) {
    return [];
  }
  const candidates = candidatesOf({ pointLines: section.sectionLines });
  return [
    {
      name: statedTokenOf({ text: pointName }),
      lineNumber: section.headingLineNumber,
      candidates,
      chosenLine: chosenLineOf({
        pointLines: section.sectionLines,
        candidates,
      }),
      rejections: rejectionsOf({ pointLines: section.sectionLines }),
    },
  ];
};

const parseOptionsLedger = ({
  markdownText,
}: {
  readonly markdownText: string;
}): OptionsLedger => ({
  points: sectionsAtLevel({
    lines: markdownLinesOf({ markdownText }),
    level: 2,
  }).flatMap((section) => decisionPointsOfSection({ section })),
});

const premisesOfChosenCandidate = ({
  point,
  chosenCandidate,
}: {
  readonly point: DecisionPoint;
  readonly chosenCandidate: LedgerCandidate;
}): ChosenPremises => {
  switch (chosenCandidate.premises.kind) {
    case "keys":
      return {
        kind: "keys",
        pointName: point.name,
        keys: chosenCandidate.premises.keys,
      };
    case "none":
      return { kind: "none", pointName: point.name };
    case "missing":
    case "malformed":
      return {
        kind: "unreadable",
        pointName: point.name,
        reason: `its chosen candidate ${chosenCandidate.letter} has no readable Premises line`,
      };
  }
};

const chosenPremisesOfPoint = ({
  point,
}: {
  readonly point: DecisionPoint;
}): ChosenPremises => {
  const chosenLine = point.chosenLine;
  switch (chosenLine.kind) {
    case "missing":
    case "malformed":
      return {
        kind: "unreadable",
        pointName: point.name,
        reason: "it has no readable Chosen line",
      };
    case "not-a-candidate":
    case "ambiguous":
      return {
        kind: "unreadable",
        pointName: point.name,
        reason: `its Chosen letter ${chosenLine.letter} does not name exactly one of its candidates`,
      };
    case "resolved":
      return premisesOfChosenCandidate({
        point,
        chosenCandidate: chosenLine.candidate,
      });
  }
};

const chosenPremisesOf = ({
  ledger,
}: {
  readonly ledger: OptionsLedger;
}): readonly ChosenPremises[] =>
  ledger.points.map((point) => chosenPremisesOfPoint({ point }));

export {
  type ChosenLine,
  type ChosenPremises,
  chosenPremisesOf,
  type DecisionPoint,
  type LedgerCandidate,
  type OptionsLedger,
  type PremiseLine,
  parseOptionsLedger,
  type Rejection,
};
