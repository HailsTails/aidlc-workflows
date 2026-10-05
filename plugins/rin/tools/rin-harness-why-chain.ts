import { z } from "zod";

const REQUIRED_WHY_COUNT = 5;

const CHAIN_LABEL = /why-chain|five\s+whys/i;

type WhyChainProblem = string;

const SYMPTOM_PHRASES = [
  String.raw`(?:the\s+)?(?:gate|check|ci|build|lint|test)s?\s+(?:was|were|is|are)\s+(?:failing|red|broken)`,
  String.raw`(?:there\s+was\s+)?no\s+time`,
  String.raw`we\s+(?:had\s+no|ran\s+out\s+of)\s+time`,
  String.raw`(?:it\s+(?:is|was)\s+)?out\s+of\s+scope`,
  String.raw`(?:it\s+(?:is|was)\s+)?(?:the\s+|an?\s+)?existing\s+(?:code|convention|pattern)`,
  String.raw`(?:a\s+|the\s+)?time\s+constraint`,
  String.raw`(?:a\s+|the\s+)?deadline`,
] as const;

const SYMPTOM_TERMINUS = new RegExp(
  String.raw`^(?:because\s+(?:of\s+)?)?(?:${SYMPTOM_PHRASES.join("|")})\b`,
  "i",
);

const restatesTheException = ({
  rootCause,
}: {
  readonly rootCause: string;
}): boolean => SYMPTOM_TERMINUS.test(rootCause.trim());

const MINIMUM_ANSWER_CHARACTERS = 12;
const MINIMUM_OWNER_CHARACTERS = 2;
const REPEATED_CHARACTER = /^(.)\1+$/;

const isSubstantive = (candidate: string): boolean =>
  candidate.trim().length >= MINIMUM_ANSWER_CHARACTERS &&
  !REPEATED_CHARACTER.test(candidate.trim());

const substantiveText = ({ refusal }: { readonly refusal: string }) =>
  z.string({ error: refusal }).refine(isSubstantive, { error: refusal });

const WHY_QUESTION_MISSING = "is missing its `why` question";
const ROOT_CAUSE_REQUIRED =
  "`whyChain.rootCause` is required — the fifth why names the cause, not another symptom";
const OWNER_REQUIRED =
  "`whyChain.owner` is required — a record dir, a capture id, or the holder of the reserved authority";

const whySchema = z.object(
  {
    why: z
      .string({ error: WHY_QUESTION_MISSING })
      .refine((question) => question.trim().length > 0, {
        error: WHY_QUESTION_MISSING,
      }),
    because: substantiveText({
      refusal:
        "carries no real `because` answer — a placeholder is an absent answer",
    }),
    evidence: substantiveText({
      refusal:
        "carries no real `evidence` — cite a command, path, record id, PR, or named ruling",
    }),
  },
  { error: "is not a JSON object" },
);

const whyChainSchema = z.object(
  {
    whys: z
      .array(whySchema, { error: "`whyChain.whys` must be an array" })
      .length(REQUIRED_WHY_COUNT, {
        error: (issue) =>
          `\`whyChain.whys\` must hold exactly ${REQUIRED_WHY_COUNT} whys, found ${Array.isArray(issue.input) ? issue.input.length : 0}`,
      }),
    rootCause: z
      .string({ error: ROOT_CAUSE_REQUIRED })
      .refine(isSubstantive, { error: ROOT_CAUSE_REQUIRED, abort: true })
      .refine((rootCause) => !restatesTheException({ rootCause }), {
        error: (issue) =>
          `\`whyChain.rootCause\` restates the exception ("${issue.input}") rather than naming its cause`,
      }),
    owner: z
      .string({ error: OWNER_REQUIRED })
      .refine((owner) => owner.trim().length >= MINIMUM_OWNER_CHARACTERS, {
        error: OWNER_REQUIRED,
      }),
  },
  { error: "`whyChain` is not a JSON object" },
);

type WhyChain = z.infer<typeof whyChainSchema>;
type Why = WhyChain["whys"][number];

const describeIssue = (issue: z.core.$ZodIssue): WhyChainProblem => {
  const [field, position] = issue.path;
  return field === "whys" && typeof position === "number"
    ? `why ${position + 1} ${issue.message}`
    : issue.message;
};

const whyChainProblem = (candidate: unknown): WhyChainProblem | undefined => {
  const parsed = whyChainSchema.safeParse(candidate);
  return parsed.success
    ? undefined
    : parsed.error.issues.map(describeIssue).join("; ");
};

const parsedWhyChain = (candidate: unknown): WhyChain | undefined => {
  const parsed = whyChainSchema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
};

export type { Why, WhyChain, WhyChainProblem };
export {
  CHAIN_LABEL,
  parsedWhyChain,
  REQUIRED_WHY_COUNT,
  restatesTheException,
  whyChainProblem,
};
