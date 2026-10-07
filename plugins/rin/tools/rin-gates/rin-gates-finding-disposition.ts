import {
  CHAIN_LABEL,
  REQUIRED_WHY_COUNT,
  restatesTheException,
} from "../rin-harness-why-chain.ts";

const DISPOSITION_WORDS = [
  "FIXED",
  "RESOLVED",
  "PUSH-?BACK",
  "DEFER(?:RED)?",
  "WITHDRAWN",
] as const;

const FIXED_WITH_SHA =
  /^(?:FIXED|RESOLVED)\b[\s:@]*(?:@|\bin\b)?\s*[0-9a-f]{7,40}\b/i;

const PUSH_BACK_WITH_GROUND = /^PUSH-?BACK\s*\([^)]*\S[^)]*\)/i;

const DEFER_WITH_ACK = /^DEFER(?:RED)?\s*\([^)]*\S[^)]*\)/i;

const WITHDRAWN_WITH_REASON = /^WITHDRAWN\s*\([^)]*\S[^)]*\)/i;

const DISPOSITION_SHAPES: readonly RegExp[] = [
  FIXED_WITH_SHA,
  PUSH_BACK_WITH_GROUND,
  DEFER_WITH_ACK,
  WITHDRAWN_WITH_REASON,
];

const EXCEPTION_DISPOSITIONS: readonly RegExp[] = [
  PUSH_BACK_WITH_GROUND,
  DEFER_WITH_ACK,
];

const MINIMUM_WHY_CHARACTERS = 12;
const WHY_QUESTION_AND_ANSWER =
  /^why\b.+?(?:\?|\s+[—–-]\s+|\bbecause\b)\s*(?:because\s+)?(\S.*?)\s*\([^()]{4,}\)/i;
const REPEATED_CHARACTER = /^(.)\1+$/;

const NUMBERED_WHY = new RegExp(
  `(?:^|[\\s|>])([1-${REQUIRED_WHY_COUNT}])\\.\\s*(.*?)(?=(?:[\\s|>]\\d+\\.\\s)|$)`,
  "gs",
);

const isReasoned = (text: string): boolean =>
  text.trim().length >= MINIMUM_WHY_CHARACTERS;

const ROOT_CAUSE_AND_OWNER =
  /root\s+cause\s*[:—-]\s*([^|\n]*?)\s*\bowner\s*:\s*([^(.|\n]+)\s*\([^()]{4,}\)/i;

const isReasonedWhy = (span: string): boolean => {
  const answer = span.trim().match(WHY_QUESTION_AND_ANSWER)?.[1]?.trim();
  return (
    answer !== undefined &&
    isReasoned(answer) &&
    !REPEATED_CHARACTER.test(answer)
  );
};

const hasCauseAndOwner = (span: string): boolean => {
  const causeAndOwner = span.match(ROOT_CAUSE_AND_OWNER);
  const rootCause = causeAndOwner?.[1]?.trim().replace(/[.]$/, "").trim();
  const owner = causeAndOwner?.[2]?.trim();
  return (
    rootCause !== undefined &&
    rootCause.length >= MINIMUM_WHY_CHARACTERS &&
    !restatesTheException({ rootCause }) &&
    owner !== undefined &&
    owner.length > 0
  );
};

const carriesNumberedChain = (text: string): boolean => {
  const steps = new Map(
    [...text.matchAll(NUMBERED_WHY)].flatMap((match) =>
      match[1] === undefined || match[2] === undefined
        ? []
        : [[Number(match[1]), match[2]] as const],
    ),
  );
  return (
    Array.from({ length: REQUIRED_WHY_COUNT - 1 }, (_, index) =>
      steps.get(index + 1),
    ).every((step) => step !== undefined && isReasonedWhy(step)) &&
    hasCauseAndOwner(steps.get(REQUIRED_WHY_COUNT) ?? "")
  );
};

const carriesCompleteChain = (finding: string): boolean =>
  CHAIN_LABEL.test(finding) && carriesNumberedChain(finding);

const isExceptionDisposition = (finding: string): boolean =>
  EXCEPTION_DISPOSITIONS.some((shape) => shape.test(finding));

const LEADING_BULLET = /^[-*]\s*/;

const UNESCAPED_PIPE = /(?<!\\)\|/;
const LEADING_PIPE = /^\|/;
const TRAILING_PIPE = /(?<!\\)\|$/;
const BACKTICK = /`/g;
const DOCUMENTED_ROW_CELLS = 3;

type JudgedRow =
  | {
      readonly kind: "table";
      readonly disposition: string;
      readonly chain: string;
    }
  | { readonly kind: "prose"; readonly text: string };

const judgedRowOf = (finding: string): JudgedRow => {
  const text = finding.trim().replace(LEADING_BULLET, "");
  const cells = text.startsWith("|")
    ? text
        .replace(LEADING_PIPE, "")
        .trimEnd()
        .replace(TRAILING_PIPE, "")
        .split(UNESCAPED_PIPE)
        .map((cell) => cell.trim())
    : [];
  const [, disposition, chain] = cells;
  return cells.length === DOCUMENTED_ROW_CELLS &&
    disposition !== undefined &&
    chain !== undefined
    ? { kind: "table", disposition: disposition.replace(BACKTICK, ""), chain }
    : { kind: "prose", text };
};

const DISPOSITION_PREFIX = new RegExp(
  `\\b(?:${DISPOSITION_WORDS.join("|")})\\b\\s*[(@:]`,
  "gi",
);

const claimedJudgements = (finding: string): number =>
  [...finding.matchAll(DISPOSITION_PREFIX)].length;

const disposes = ({
  disposition,
  chainComplete,
  exceptionWhyChainsEnabled,
}: {
  readonly disposition: string;
  readonly chainComplete: boolean;
  readonly exceptionWhyChainsEnabled: boolean;
}): boolean =>
  claimedJudgements(disposition) <= 1 &&
  DISPOSITION_SHAPES.some((shape) => shape.test(disposition)) &&
  (!exceptionWhyChainsEnabled ||
    !isExceptionDisposition(disposition) ||
    chainComplete);

const isDisposed = ({
  finding,
  exceptionWhyChainsEnabled,
}: {
  readonly finding: string;
  readonly exceptionWhyChainsEnabled: boolean;
}): boolean => {
  const row = judgedRowOf(finding);
  switch (row.kind) {
    case "table":
      return disposes({
        disposition: row.disposition,
        chainComplete: carriesNumberedChain(row.chain),
        exceptionWhyChainsEnabled,
      });
    case "prose":
      return disposes({
        disposition: row.text,
        chainComplete: carriesCompleteChain(row.text),
        exceptionWhyChainsEnabled,
      });
  }
};

const blockingFindingsWithPolicy = ({
  findings,
  exceptionWhyChainsEnabled,
}: {
  readonly findings: readonly string[];
  readonly exceptionWhyChainsEnabled: boolean;
}): readonly string[] =>
  findings.filter(
    (finding) => !isDisposed({ finding, exceptionWhyChainsEnabled }),
  );

export const blockingFindingsIn = (
  findings: readonly string[],
): readonly string[] =>
  blockingFindingsWithPolicy({ findings, exceptionWhyChainsEnabled: true });

export {
  blockingFindingsWithPolicy,
  carriesCompleteChain,
  isExceptionDisposition,
};
