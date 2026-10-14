import { z } from "zod";

export type Why = {
  readonly why: string;
  readonly because: string;
  readonly evidence: string;
};

export type WhyChain = {
  readonly whys: readonly [Why, Why, Why, Why, Why];
  readonly rootCause: string;
  readonly owner: string;
};

const RESTATEMENT_PHRASES = [
  String.raw`(?:the\s+)?(?:gate|check|ci|build|lint|test)s?\s+(?:was|were|is|are)\s+(?:failing|red|broken)`,
  String.raw`(?:there\s+was\s+)?no\s+time`,
  String.raw`we\s+(?:had\s+no|ran\s+out\s+of)\s+time`,
  String.raw`(?:it\s+(?:is|was)\s+)?out\s+of\s+scope`,
  String.raw`(?:it\s+(?:is|was)\s+)?(?:the\s+|an?\s+)?existing\s+(?:code|convention|pattern)`,
  String.raw`(?:a\s+|the\s+)?time\s+constraint`,
  String.raw`(?:a\s+|the\s+)?deadline`,
];

const RESTATEMENT_OPENING = new RegExp(
  String.raw`^(?:because\s+(?:of\s+)?)?(?:${RESTATEMENT_PHRASES.join("|")})\b`,
  "i",
);

const MINIMUM_ANSWER_CHARACTERS = 12;
const MINIMUM_OWNER_CHARACTERS = 2;
const ONE_REPEATED_CHARACTER = /^(.)\1+$/;

const restatesTheException = (request: {
  readonly rootCause: string;
}): boolean => RESTATEMENT_OPENING.test(request.rootCause.trim());

const isSubstantive = (request: { readonly answer: string }): boolean =>
  request.answer.trim().length >= MINIMUM_ANSWER_CHARACTERS &&
  !ONE_REPEATED_CHARACTER.test(request.answer.trim());

const substantiveTextSchema = (request: { readonly refusal: string }) =>
  z
    .string({ error: request.refusal })
    .refine((answer) => isSubstantive({ answer }), { error: request.refusal });

const WHY_QUESTION_MISSING = "is missing its `why` question";
const ROOT_CAUSE_REQUIRED =
  "`whyChain.rootCause` is required: the fifth why names the cause, not another symptom";
const OWNER_REQUIRED =
  "`whyChain.owner` is required: a record dir, a capture id, or the holder of the reserved authority";

const whySchema = z.object(
  {
    why: z
      .string({ error: WHY_QUESTION_MISSING })
      .refine((question) => question.trim().length > 0, {
        error: WHY_QUESTION_MISSING,
      }),
    because: substantiveTextSchema({
      refusal:
        "carries no real `because` answer: a placeholder is an absent answer",
    }),
    evidence: substantiveTextSchema({
      refusal:
        "carries no real `evidence`: cite a command, path, record id, PR, or named ruling",
    }),
  },
  { error: "is not a JSON object" },
);

export const whyChainSchema: z.ZodType<WhyChain> = z.object(
  {
    whys: z.tuple([whySchema, whySchema, whySchema, whySchema, whySchema], {
      error: "`whyChain.whys` must hold exactly 5 whys",
    }),
    rootCause: z
      .string({ error: ROOT_CAUSE_REQUIRED })
      .refine((answer) => isSubstantive({ answer }), {
        error: ROOT_CAUSE_REQUIRED,
        abort: true,
      })
      .refine((rootCause) => !restatesTheException({ rootCause }), {
        error: "`whyChain.rootCause` restates the exception rather than naming its cause",
      }),
    owner: z
      .string({ error: OWNER_REQUIRED })
      .refine((owner) => owner.trim().length >= MINIMUM_OWNER_CHARACTERS, {
        error: OWNER_REQUIRED,
      }),
  },
  { error: "`whyChain` is not a JSON object" },
);
