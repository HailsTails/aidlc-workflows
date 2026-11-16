import { describe, expect, test } from "vitest";
import {
  gitHistoryReader,
  measureReviewRounds,
  type ReviewHistoryReader,
  refsFrom,
} from "./review-rounds-cli.ts";

const FIRST_ROUND_PATH =
  "aidlc/spaces/default/intents/260101-sample/inception/rin-gate-1-framing/reviews/review-01.md";

const FIRST_ROUND =
  "**Verdict:** NOT-READY\n\n| ID | Finding | Status |\n| --- | --- | --- |\n| R-01 | the window has no timezone | New |\n| R-02 | the runtime has no deadline | New |";

const ONE_REVIEW_ON_EVERY_REF: ReviewHistoryReader = {
  reviewPathsAt: () => [FIRST_ROUND_PATH],
  reviewTextAt: () => FIRST_ROUND,
};

describe("the measure reads review files across the refs it is given", () => {
  test("a file present on two refs is counted once", () => {
    expect(
      measureReviewRounds({
        refs: ["main", "lane"],
        reader: ONE_REVIEW_ON_EVERY_REF,
      }),
    ).toContain("| 260101-sample | rin-gate-1-framing | 1 | NOT-READY | 2 |");
  });

  test("the share counts nothing raised after round 1 when there is one round", () => {
    expect(
      measureReviewRounds({
        refs: ["main", "lane"],
        reader: ONE_REVIEW_ON_EVERY_REF,
      }),
    ).toContain("Findings first raised after round 1: 0 of 2 (0.0%)");
  });

  test("with no ref named the measure reads HEAD", () => {
    expect(refsFrom({ args: [] })).toEqual(["HEAD"]);
  });

  test("each named ref is read", () => {
    expect(
      refsFrom({ args: ["--ref", "origin/main", "--ref", "origin/lane"] }),
    ).toEqual(["origin/main", "origin/lane"]);
  });
});

describe("review files are read from git history, not the working tree", () => {
  test("only paths under a reviews directory are review files", () => {
    expect(
      gitHistoryReader({
        runGit: () => ({
          status: 0,
          stdout:
            "aidlc/spaces/default/intents/260101-sample/intent.md\naidlc/spaces/default/intents/260101-sample/inception/rin-gate-1-framing/reviews/review-01.md\n",
          stderr: "",
        }),
      }).reviewPathsAt({ ref: "main" }),
    ).toEqual([FIRST_ROUND_PATH]);
  });

  test("a review's text is what git shows for it at the ref", () => {
    expect(
      gitHistoryReader({
        runGit: () => ({ status: 0, stdout: FIRST_ROUND, stderr: "" }),
      }).reviewTextAt({ ref: "main", path: FIRST_ROUND_PATH }),
    ).toBe(FIRST_ROUND);
  });

  test("a git failure stops the measure with git's own message", () => {
    expect(() =>
      gitHistoryReader({
        runGit: () => ({
          status: 128,
          stdout: "",
          stderr: "fatal: bad revision\n",
        }),
      }).reviewTextAt({ ref: "gone", path: FIRST_ROUND_PATH }),
    ).toThrow("git show gone:");
  });
});
