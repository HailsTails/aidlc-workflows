import { z } from "zod";
import { type Stems, stemsOf, stemsShared, stemsWithout, wordsOf } from "./chain-stems.ts";

export type Why = {
  readonly why: string;
  readonly because: string;
  readonly evidence: string;
};

type FiveWhys = readonly [Why, Why, Why, Why, Why];

export type LegacyWhyChain = {
  readonly whys: FiveWhys;
  readonly rootCause: string;
  readonly owner: string;
  readonly rootCheck?: never;
  readonly readback?: never;
};

export type WhyChain = {
  readonly whys: FiveWhys;
  readonly rootCause: string;
  readonly rootCheck: string;
  readonly readback: string;
  readonly owner: string;
};

export type RecordedWhyChain = WhyChain | LegacyWhyChain;

export type WhyChainForm = "causal" | "legacy";

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
const MINIMUM_SYMPTOM_STEMS_NAMED = 2;
const ONE_REPEATED_CHARACTER = /^(.)\1+$/;
const PROSE_LOOKALIKES = /\b(?:e\.g\b\.?|i\.e\b\.?|a\.k\.a\.|etc\.|[ap]\.m\.)|(?<![\w./\\-])(?:and\/or|n\/a|w\/o|yes\/no)(?![\w./\\-])/gi;
const CHECKABLE_LOCATORS: readonly RegExp[] = [
  /https?:\/\/\S/i,
  /[\w.-][\\/][\w.-]/,
  /(?:^|[\s(\x60'"])(?:\*|[\w-]+)(?:\.[\w-]+)*\.[a-z][a-z0-9]{0,9}\b/,
  /(?:^|[\s(\x60'"])\.[a-z][\w-]+\b/,
  /\d/,
];
const THEREFORE = /\btherefore\b/i;

const rootCauseReading = (request: {
  readonly rootCause: string;
}): "restates-the-exception" | "names-a-cause" =>
  RESTATEMENT_OPENING.test(request.rootCause.trim())
    ? "restates-the-exception"
    : "names-a-cause";

const answerSubstance = (request: {
  readonly answer: string;
}): "substantive" | "placeholder" =>
  request.answer.trim().length >= MINIMUM_ANSWER_CHARACTERS &&
  !ONE_REPEATED_CHARACTER.test(request.answer.trim())
    ? "substantive"
    : "placeholder";

const evidenceReading = (request: { readonly evidence: string }): "checkable" | "unlocated" =>
  CHECKABLE_LOCATORS.some((locator) => locator.test(request.evidence.replace(PROSE_LOOKALIKES, " ")))
    ? "checkable"
    : "unlocated";

const substantiveTextSchema = (request: { readonly refusal: string }) =>
  z
    .string({ error: request.refusal })
    .refine((answer) => answerSubstance({ answer }) === "substantive", {
      error: request.refusal,
    });

const checkableTextSchema = (request: { readonly missing: string; readonly unlocated: string }) =>
  substantiveTextSchema({ refusal: request.missing }).refine((evidence) => evidenceReading({ evidence }) === "checkable", {
    error: request.unlocated,
  });

const WHY_QUESTION_MISSING = "is missing its `why` question";
const BECAUSE_MISSING = "carries no real `because` answer: a placeholder is an absent answer";
const EVIDENCE_MISSING = "carries no real `evidence`: cite a command, path, record id, PR, or named ruling";
const EVIDENCE_UNLOCATED =
  "carries no checkable `evidence`: cite a path, a line, a record or PR number, a measurement or a link";
const ROOT_CAUSE_REQUIRED =
  "`whyChain.rootCause` is required: the fifth why names the cause, not another symptom";
const ROOT_CHECK_REQUIRED =
  "`whyChain.rootCheck` is required beside `readback` in a causal chain: name what was run or read today that shows the root still holds, with a path, record, measurement or link";
const ROOT_CHECK_UNLOCATED =
  "`whyChain.rootCheck` cites nothing checkable: name the path, record, measurement or link you checked today";
const READBACK_REQUIRED =
  "`whyChain.readback` is required beside `rootCheck` in a causal chain: read from the root back to the symptom with \"therefore\"";
const OWNER_REQUIRED =
  "`whyChain.owner` is required: a record dir, a capture id, or the holder of the reserved authority";

const whyQuestionSchema = z
  .string({ error: WHY_QUESTION_MISSING })
  .refine((question) => question.trim().length > 0, {
    error: WHY_QUESTION_MISSING,
  });

const legacyWhySchema = z.object(
  {
    why: whyQuestionSchema,
    because: substantiveTextSchema({ refusal: BECAUSE_MISSING }),
    evidence: substantiveTextSchema({ refusal: EVIDENCE_MISSING }),
  },
  { error: "is not a JSON object" },
);

const causalWhySchema = z.object(
  {
    why: whyQuestionSchema,
    because: substantiveTextSchema({ refusal: BECAUSE_MISSING }),
    evidence: checkableTextSchema({ missing: EVIDENCE_MISSING, unlocated: EVIDENCE_UNLOCATED }),
  },
  { error: "is not a JSON object" },
);

const fiveWhysSchema = (request: { readonly why: z.ZodType<Why> }) =>
  z.tuple([request.why, request.why, request.why, request.why, request.why], {
    error: "`whyChain.whys` must hold exactly 5 whys",
  });

const rootCauseSchema = z
  .string({ error: ROOT_CAUSE_REQUIRED })
  .refine((answer) => answerSubstance({ answer }) === "substantive", {
    error: ROOT_CAUSE_REQUIRED,
    abort: true,
  })
  .refine((rootCause) => rootCauseReading({ rootCause }) === "names-a-cause", {
    error: "`whyChain.rootCause` restates the exception rather than naming its cause",
  });

const ownerSchema = z
  .string({ error: OWNER_REQUIRED })
  .refine((owner) => owner.trim().length >= MINIMUM_OWNER_CHARACTERS, {
    error: OWNER_REQUIRED,
  });

export const legacyWhyChainSchema: z.ZodType<LegacyWhyChain> = z.object(
  {
    whys: fiveWhysSchema({ why: legacyWhySchema }),
    rootCause: rootCauseSchema,
    owner: ownerSchema,
  },
  { error: "`whyChain` is not a JSON object" },
);

export type CausalProblem = {
  readonly path: readonly (string | number)[];
  readonly message: string;
};

const causeNamed = (request: { readonly cause: Stems }): string => wordsOf({ stems: request.cause }).join(", ");

const restatementProblems = (request: {
  readonly introduced: readonly Stems[];
}): readonly CausalProblem[] =>
  request.introduced.flatMap((cause, position) =>
    cause.size === 0
      ? [
          {
            path: ["whys", position, "because"],
            message: `restates ${position === 0 ? "the symptom" : "the symptom or an earlier answer"}: give the cause behind it, in words no earlier step uses`,
          },
        ]
      : [],
  );

const linkProblems = (request: {
  readonly whys: FiveWhys;
  readonly introduced: readonly Stems[];
}): readonly CausalProblem[] =>
  request.introduced.slice(0, -1).flatMap((cause, position) =>
    cause.size > 0 &&
    stemsShared({ left: cause, right: stemsOf({ text: request.whys[position + 1]?.why ?? "" }) }).size === 0
      ? [
          {
            path: ["whys", position + 1, "why"],
            message: `does not ask about the cause why ${position + 1}'s answer gave: ask why that answer is true, naming its cause (${causeNamed({ cause })})`,
          },
        ]
      : [],
  );

const rootProblems = (request: {
  readonly rootCause: string;
  readonly fifthCause: Stems;
}): readonly CausalProblem[] =>
  request.fifthCause.size > 0 &&
  stemsShared({ left: request.fifthCause, right: stemsOf({ text: request.rootCause }) }).size === 0
    ? [
        {
          path: ["rootCause"],
          message: `\`whyChain.rootCause\` does not name the cause why 5's answer gave: the root is the cause behind that answer (${causeNamed({ cause: request.fifthCause })})`,
        },
      ]
    : [];

const readbackProblems = (request: {
  readonly readback: string;
  readonly rootCause: string;
  readonly symptom: Stems;
}): readonly CausalProblem[] => {
  const readback = stemsOf({ text: request.readback });
  const root = stemsOf({ text: request.rootCause });
  const symptomNamed = stemsShared({ left: request.symptom, right: readback }).size;
  return [
    ...(THEREFORE.test(request.readback)
      ? []
      : ["`whyChain.readback` must read from the root back to the symptom with \"therefore\""]),
    ...(root.size > 0 && stemsShared({ left: root, right: readback }).size === 0
      ? [`\`whyChain.readback\` must start from the root (${causeNamed({ cause: root })})`]
      : []),
    ...(symptomNamed < Math.min(MINIMUM_SYMPTOM_STEMS_NAMED, request.symptom.size)
      ? [`\`whyChain.readback\` must end at the symptom why 1 asks about (${causeNamed({ cause: request.symptom })})`]
      : []),
  ].map((message) => ({ path: ["readback"], message }));
};

export const causalProblemsOf = (request: { readonly chain: WhyChain }): readonly CausalProblem[] => {
  const { whys, rootCause, readback } = request.chain;
  const symptom = stemsOf({ text: whys[0].why });
  const answers = whys.map((step) => stemsOf({ text: step.because }));
  const introduced = answers.map((answer, position) =>
    stemsWithout({ stems: answer, excluded: [symptom, ...answers.slice(0, position)] }),
  );
  return [
    ...restatementProblems({ introduced }),
    ...linkProblems({ whys, introduced }),
    ...rootProblems({ rootCause, fifthCause: introduced[4] ?? new Map() }),
    ...readbackProblems({ readback, rootCause, symptom }),
  ];
};

export const whyChainSchema: z.ZodType<WhyChain> = z
  .object(
    {
      whys: fiveWhysSchema({ why: causalWhySchema }),
      rootCause: rootCauseSchema,
      rootCheck: checkableTextSchema({ missing: ROOT_CHECK_REQUIRED, unlocated: ROOT_CHECK_UNLOCATED }),
      readback: substantiveTextSchema({ refusal: READBACK_REQUIRED }),
      owner: ownerSchema,
    },
    { error: "`whyChain` is not a JSON object" },
  )
  .superRefine((chain, context) => {
    causalProblemsOf({ chain }).forEach((problem) => {
      context.addIssue({ code: "custom", path: [...problem.path], message: problem.message });
    });
  });

export const whyChainFormOf = (request: { readonly chain: unknown }): WhyChainForm =>
  typeof request.chain === "object" &&
  request.chain !== null &&
  !Array.isArray(request.chain) &&
  !("rootCheck" in request.chain) &&
  !("readback" in request.chain)
    ? "legacy"
    : "causal";
