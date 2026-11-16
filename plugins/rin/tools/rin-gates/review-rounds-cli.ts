import { defaultReviewProcessPort } from "./review-process-port.ts";
import {
  type GatePairMeasure,
  gatePairMeasureOf,
  parseReview,
  type ReviewFileLocation,
  type ReviewRound,
  renderReviewRoundsMeasure,
  reviewFileLocationOf,
  reviewRoundsMeasureOf,
} from "./review-rounds.ts";

const INTENTS_ROOT = "aidlc/spaces/default/intents";
const REF_FLAG = "--ref";
const DEFAULT_REFS: readonly string[] = ["HEAD"];

type ReviewHistoryReader = {
  readonly reviewPathsAt: (input: {
    readonly ref: string;
  }) => readonly string[];
  readonly reviewTextAt: (input: {
    readonly ref: string;
    readonly path: string;
  }) => string;
};

type LocatedReview = ReviewFileLocation & { readonly ref: string };

type GitOutput = {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
};

const gitHistoryReader = ({
  runGit,
}: {
  readonly runGit: (args: readonly string[]) => GitOutput;
}): ReviewHistoryReader => {
  const git = (args: readonly string[]): string => {
    const result = runGit(args);
    if (result.status !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
    }
    return result.stdout;
  };
  return {
    reviewPathsAt: ({ ref }) =>
      git(["ls-tree", "-r", "--name-only", ref, INTENTS_ROOT])
        .split("\n")
        .filter((path) => path.includes("/reviews/")),
    reviewTextAt: ({ ref, path }) => git(["show", `${ref}:${path}`]),
  };
};

const refsFrom = ({
  args,
}: {
  readonly args: readonly string[];
}): readonly string[] => {
  const named = args.flatMap((argument, index) =>
    args[index - 1] === REF_FLAG ? [argument] : [],
  );
  return named.length > 0 ? named : DEFAULT_REFS;
};

const locatedReviewsAcross = ({
  refs,
  reader,
}: {
  readonly refs: readonly string[];
  readonly reader: ReviewHistoryReader;
}): readonly LocatedReview[] => {
  const firstRefByPath = new Map<string, LocatedReview>();
  refs.forEach((ref) => {
    reader.reviewPathsAt({ ref }).forEach((path) => {
      const location = reviewFileLocationOf({ path });
      if (location !== null && !firstRefByPath.has(path)) {
        firstRefByPath.set(path, { ...location, ref });
      }
    });
  });
  return [...firstRefByPath.values()];
};

const gatePairMeasuresOf = ({
  reviews,
  reader,
}: {
  readonly reviews: readonly LocatedReview[];
  readonly reader: ReviewHistoryReader;
}): readonly GatePairMeasure[] => {
  const roundsByPair = new Map<
    string,
    { readonly record: string; readonly gate: string; rounds: ReviewRound[] }
  >();
  reviews.forEach((review) => {
    const key = `${review.record}|${review.gate}`;
    const pair = roundsByPair.get(key) ?? {
      record: review.record,
      gate: review.gate,
      rounds: [],
    };
    pair.rounds.push({
      round: review.round,
      ...parseReview({ text: reader.reviewTextAt(review) }),
    });
    roundsByPair.set(key, pair);
  });
  return [...roundsByPair.values()]
    .map(gatePairMeasureOf)
    .sort(
      (left, right) =>
        left.record.localeCompare(right.record) ||
        left.gate.localeCompare(right.gate),
    );
};

const measureReviewRounds = ({
  refs,
  reader,
}: {
  readonly refs: readonly string[];
  readonly reader: ReviewHistoryReader;
}): string =>
  renderReviewRoundsMeasure({
    refs,
    measure: reviewRoundsMeasureOf({
      pairs: gatePairMeasuresOf({
        reviews: locatedReviewsAcross({ refs, reader }),
        reader,
      }),
    }),
  });

if (import.meta.main) {
  const runtime = defaultReviewProcessPort();
  runtime.publish(
    `${measureReviewRounds({
      refs: refsFrom({ args: runtime.arguments.slice(2) }),
      reader: gitHistoryReader({
        runGit: (args) => runtime.runSync({ program: "git", args, cwd: "." }),
      }),
    })}\n`,
  );
}

export {
  gitHistoryReader,
  measureReviewRounds,
  type ReviewHistoryReader,
  refsFrom,
};
