import { describe, expect, test } from "vitest";
import { blockingFindingsIn } from "./rin-gates-finding-disposition.ts";

const LIVE =
  "src/kernel/a.ts:12 | const parsed = raw as Config | CD-2 | cast defeats the type";

describe("a cited finding blocks unless it is disposed with evidence", () => {
  test("an ordinary cited finding is live", () => {
    expect(blockingFindingsIn([LIVE])).toEqual([LIVE]);
  });

  test("a list bullet does not change whether a finding blocks", () => {
    expect(blockingFindingsIn([`- ${LIVE}`])).toEqual([`- ${LIVE}`]);
  });

  test("nothing cited means nothing blocking", () => {
    expect(blockingFindingsIn([])).toEqual([]);
  });
});

// The ratified closed set is fixed@<sha> / push-back(<ground>) / defer(ack:<ref>)
// (rin-gate-5-review-cycle.md:110-111). The trailing reference IS the disposition;
// a bare prefix is not one.
describe("each ratified disposition is accepted when it carries its evidence", () => {
  test.each([
    ["fixed with a sha", `fixed@a1b2c3d4 ${LIVE}`],
    ["resolved with a sha", `RESOLVED: 667ef9c4 ${LIVE}`],
    [
      "push-back citing a CD rule",
      `push-back(CD-2 permits this cast context) ${LIVE}`,
    ],
    [
      "push-back citing a coordinate",
      `PUSH-BACK(src/kernel/a.ts:12 is generated) ${LIVE}`,
    ],
    ["defer with an ack", `defer(ack:Operator 2026-08-09) ${LIVE}`],
    ["defer with a task id", `DEFERRED(task 019f6d3e-fa88) ${LIVE}`],
    ["withdrawn with a reason", `WITHDRAWN(misread the port boundary) ${LIVE}`],
  ])("%s is disposed", (_label, finding) => {
    expect(blockingFindingsIn([finding])).toEqual([]);
  });
});

// The defect this predicate was rewritten to close. A bare disposition word is
// exactly the laundering channel `non-blocking note` used to be — more credible
// sounding, and therefore worse.
describe("a bare disposition word does NOT dispose a finding", () => {
  test.each([
    ["bare DEFERRED", `DEFERRED: ${LIVE}`],
    ["bare defer", `defer ${LIVE}`],
    ["bare FIXED with no sha", `FIXED: ${LIVE}`],
    ["bare RESOLVED with no sha", `RESOLVED ${LIVE}`],
    ["bare WITHDRAWN with nothing after it", "WITHDRAWN"],
    // The self-justification shape. Every cited finding carries a CD-id and a
    // file:line by construction, so a ground requirement satisfied by ANY such
    // token appearing after the prefix would be met by the finding itself. The
    // ground must be delimited as the author's own span.
    [
      "push-back whose only 'ground' is the finding's own coordinate",
      `push-back: ${LIVE}`,
    ],
    ["defer whose only 'ack' is the finding's own text", `DEFERRED: ${LIVE}`],
    ["push-back with empty parens", `push-back() ${LIVE}`],
    ["defer with whitespace-only parens", `defer(   ) ${LIVE}`],
    // `withdrawn` is the disposition that needs the delimiter MOST, not least:
    // the other three carry an externally checkable referent (a sha, a ground, an
    // ack), while a withdrawal is self-serve by design — so the delimiter is the
    // only check there can be.
    [
      "withdrawn whose only 'reason' is the finding's own text",
      `WITHDRAWN: ${LIVE}`,
    ],
    ["withdrawn with empty parens", `withdrawn() ${LIVE}`],
  ])("%s stays blocking", (_label, finding) => {
    expect(blockingFindingsIn([finding])).toEqual([finding]);
  });
});

// Scope item 3 of task 019f6d3e: abolishing "non-blocking note" as a disposition.
describe("non-blocking note and its neighbours are not dispositions", () => {
  test.each([
    ["non-blocking note", `non-blocking note: ${LIVE}`],
    ["NON-BLOCKING", `NON-BLOCKING ${LIVE}`],
    ["note", `note: ${LIVE}`],
    ["nit", `nit: ${LIVE}`],
    ["minor", `minor: ${LIVE}`],
    ["observation", `observation: ${LIVE}`],
  ])("%s stays blocking", (_label, finding) => {
    expect(blockingFindingsIn([finding])).toEqual([finding]);
  });
});

describe("only the disposed findings are filtered out", () => {
  test("a mixed set returns exactly the live rows, in order", () => {
    const second =
      "src/b.ts:3 | function f(a, b) | CD-45 | positional arguments";
    expect(
      blockingFindingsIn([LIVE, `fixed@a1b2c3d4 handled`, second]),
    ).toEqual([LIVE, second]);
  });
});
