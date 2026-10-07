import { describe, expect, test } from "vitest";
import { REQUIRED_WHY_COUNT } from "../rin-harness-why-chain.ts";
import {
  blockingFindingsIn,
  blockingFindingsWithPolicy,
} from "./rin-gates-finding-disposition.ts";

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

describe("each ratified disposition is accepted when it carries its evidence", () => {
  test.each([
    ["fixed with a sha", `fixed@a1b2c3d4 ${LIVE}`],
    ["resolved with a sha", `RESOLVED: 667ef9c4 ${LIVE}`],
    ["withdrawn with a reason", `WITHDRAWN(misread the port boundary) ${LIVE}`],
  ])("%s is disposed", (_label, finding) => {
    expect(blockingFindingsIn([finding])).toEqual([]);
  });
});

const WHY_CHAIN = [
  "why-chain:",
  "1. why is the cast here? because the port returns unknown (port.ts:12).",
  "2. why unknown? because the upstream SDK types it so (sdk.ts:8).",
  "3. why not narrow at the seam? because no schema exists yet (schema.ts:1).",
  "4. why no schema? because the boundary was added before Zod landed (PR #906).",
  "5. root cause: the boundary predates the Zod rail. owner: capture 01a0b421 (record 01a0b421).",
].join(" ");

describe("an exception disposition carrying its chain is disposed", () => {
  test.each([
    [
      "push-back citing a CD rule",
      `push-back(CD-2 permits this cast context) ${WHY_CHAIN} ${LIVE}`,
    ],
    ["defer with an ack", `defer(ack:Operator 2026-08-09) ${WHY_CHAIN} ${LIVE}`],
    [
      "defer with a task id",
      `DEFERRED(task 019f6d3e-fa88) ${WHY_CHAIN} ${LIVE}`,
    ],
  ])("%s is disposed", (_label, finding) => {
    expect(blockingFindingsIn([finding])).toEqual([]);
  });
});

test("a project without R7 accepts the existing acknowledged defer shape", () => {
  const finding = `defer(ack:Operator 2026-08-09) ${LIVE}`;
  expect(
    blockingFindingsWithPolicy({
      findings: [finding],
      exceptionWhyChainsEnabled: false,
    }),
  ).toEqual([]);
});

const COLUMN_CHAIN = [
  "1. Why is the cast here? — the port returns unknown (port.ts:12).",
  "<br> 2. Why unknown? — the upstream SDK types it so (sdk.ts:8).",
  "<br> 3. Why not narrow at the seam? — no schema exists yet (schema.ts:1).",
  "<br> 4. Why no schema? — the boundary was added before Zod landed (PR #906).",
  "<br> 5. root cause: the boundary predates the Zod rail. owner: capture 01a0b421 (record 01a0b421).",
].join(" ");

describe("the contract's documented TABLE shape is disposed", () => {
  test("a compliant table row is disposed, the column being the chain label", () => {
    const row = `| rin-pr-evades: cast at a.ts:12 | defer(ack:Operator 2026-09-18) | ${COLUMN_CHAIN} |`;
    expect(blockingFindingsIn([row])).toEqual([]);
  });

  test("a backticked disposition token in the table is disposed", () => {
    const row = `| rin-pr-evades: cast at a.ts:12 | \`defer(ack:Operator 2026-09-18)\` | ${COLUMN_CHAIN} |`;
    expect(blockingFindingsIn([row])).toEqual([]);
  });

  test("a disposition whose ack contains a colon is disposed", () => {
    const row = `| rin-pr-evades: cast at a.ts:12 | defer(ack: Helen 2026-09-27 ruling: carried row E-2) | ${COLUMN_CHAIN} |`;
    expect(blockingFindingsIn([row])).toEqual([]);
  });

  test("a table row whose chain cell is empty stays live", () => {
    const row = "| rin-pr-evades: cast at a.ts:12 | defer(ack:Operator) | none |";
    expect(blockingFindingsIn([row])).toEqual([row]);
  });

  test("a table row carrying no disposition token stays live", () => {
    const row = `| rin-pr-evades: cast at a.ts:12 | unresolved | ${COLUMN_CHAIN} |`;
    expect(blockingFindingsIn([row])).toEqual([row]);
  });

  test("a table row with a fixed disposition needs no chain", () => {
    const row =
      "| rin-pr-evades: cast at a.ts:12 | fixed@`a1b2c3d4e5f6` — the cast is removed | not applicable: fixed |";
    expect(blockingFindingsIn([row])).toEqual([]);
  });

  test("a table row whose disposition cell claims two judgements stays live", () => {
    const row = `| rin-pr-evades: cast at a.ts:12 | defer(ack:Operator) push-back(CD-2 permits it) | ${COLUMN_CHAIN} |`;
    expect(blockingFindingsIn([row])).toEqual([row]);
  });
});

describe("a later cell never disposes a finding", () => {
  test.each([
    [
      "a later cell beginning fixed@<sha> in a table row",
      "| src/a.ts:12 cast | CD-2 | fixed@a1b2c3d4 handled |",
    ],
    [
      "a later cell beginning withdrawn( in a table row",
      "| src/a.ts:12 cast | CD-2 | withdrawn(the lens misread the seam) |",
    ],
    [
      "a later cell beginning fixed@<sha> in a prose row",
      "src/a.ts:12 | CD-2 cast | fixed@a1b2c3d4 handled",
    ],
    [
      "a later cell beginning withdrawn( in a prose row",
      "src/a.ts:12 | CD-2 cast | withdrawn(the lens misread the seam)",
    ],
    [
      "a later cell beginning fixed@<sha> in a four-column table row",
      "| src/a.ts:12 | cast | CD-2 | fixed@a1b2c3d4 handled |",
    ],
  ])("%s stays live", (_label, row) => {
    expect(blockingFindingsIn([row])).toEqual([row]);
  });
});

describe("an element claiming two judgements disposes neither", () => {
  test("two disposition tokens sharing one chain stay live", () => {
    const finding = `defer(ack:A) ${WHY_CHAIN} defer(ack:B) src/api/user.ts:88 | CD-32 | PII reaches a log`;
    expect(blockingFindingsIn([finding])).toEqual([finding]);
  });

  test("two tokens of different kinds also stay live", () => {
    const finding = `fixed@a1b2c3d4 first finding push-back(CD-2 permits it) second finding`;
    expect(blockingFindingsIn([finding])).toEqual([finding]);
  });

  test("the same two findings as separate elements judge separately", () => {
    const disposed = `defer(ack:A) ${WHY_CHAIN}`;
    const live = "src/api/user.ts:88 | CD-32 | PII reaches a log";
    expect(blockingFindingsIn([disposed, live])).toEqual([live]);
  });
});

describe("a disposition token after a finding separator does not dispose a prose row", () => {
  test.each([
    ["a pipe", "|"],
    ["an em-dash", "—"],
    ["an en-dash", "–"],
    ["an arrow", "->"],
    ["a fat arrow", "=>"],
    ["a double colon", "::"],
    ["a colon", ":"],
  ])("a row separated by %s stays live", (_label, separator) => {
    const finding = `src/kernel/a.ts:12 CD-2 cast ${separator} defer(ack:Operator) ${WHY_CHAIN}`;
    expect(blockingFindingsIn([finding])).toEqual([finding]);
  });
});

describe("both spellings of the chain label are accepted", () => {
  test.each([
    ["the contract's hyphenated form", "why-chain"],
    ["R7's own phrase", "Five Whys"],
    ["R7's phrase in lower case", "five whys"],
  ])("a row labelled with %s is disposed", (_label, spelling) => {
    expect(
      blockingFindingsIn([
        `defer(ack:Operator) ${spelling}: ${WHY_CHAIN.replace("why-chain:", "")}`,
      ]),
    ).toEqual([]);
  });

  test("a row with no label at all still stays live", () => {
    const finding = `defer(ack:Operator) ${WHY_CHAIN.replace("why-chain:", "")}`;
    expect(blockingFindingsIn([finding])).toEqual([finding]);
  });
});

describe("a chain terminating at a symptom stays live at THIS door too", () => {
  const chainEndingAt = (rootCause: string): string =>
    `defer(ack:Operator) why-chain 1. why deferred — the walker cannot express it (cd-5.json:3) 2. why not — matcher predates AIDLC (audit.ts:44) 3. why unfixed — nobody re-minted it (git log) 4. why unnoticed — no gate read it (PR #906) 5. root cause: ${rootCause} owner: 01a0b421 (record 01a0b421). ${LIVE}`;

  test.each([
    ["out of scope", "out of scope for this record."],
    ["the gate was failing", "the gate was failing."],
    ["no time", "no time before the gate closed."],
    ["existing convention", "existing convention in this package."],
  ])("a root cause of %s stays live", (_label, rootCause) => {
    const finding = chainEndingAt(rootCause);
    expect(blockingFindingsIn([finding])).toEqual([finding]);
  });

  test("a genuine cause at the same position is disposed", () => {
    expect(
      blockingFindingsIn([
        chainEndingAt("the matcher outlived its numbering scheme."),
      ]),
    ).toEqual([]);
  });

  test.each([
    ["a bracketed word", "capture 01a0b421 (deadline triage)"],
    ["a team name", "the out of scope sweep"],
    ["a trailing clause", "record 260918-x, no time budget"],
  ])("an owner containing %s does not refuse the chain", (_label, owner) => {
    const finding = `defer(ack:Operator) why-chain 1. why deferred — the walker cannot express it (cd-5.json:3) 2. why not — matcher predates AIDLC (audit.ts:44) 3. why unfixed — nobody re-minted it (git log) 4. why unnoticed — no gate read it (PR #906) 5. root cause: the matcher outlived its scheme. owner: ${owner} (record 01a0b421). ${LIVE}`;
    expect(blockingFindingsIn([finding])).toEqual([]);
  });
});

describe("an exception disposition with no complete chain stays live", () => {
  test.each([
    ["push-back with no chain", `push-back(CD-2 permits this) ${LIVE}`],
    ["defer with no chain", `defer(ack:Operator 2026-08-09) ${LIVE}`],
    [
      "a chain marker carrying only three whys",
      `defer(ack:Operator) why-chain: 1. a 2. b 3. c ${LIVE}`,
    ],
    [
      "three fully reasoned whys reaching a root cause",
      `defer(ack:Operator) why-chain: 1. why deferred — the walker cannot express it (cd-5.json:3) 2. why not — matcher predates AIDLC (audit.ts:44) 3. root cause: the matcher outlived its scheme. owner: 01a0b421. ${LIVE}`,
    ],
    [
      "four fully reasoned whys reaching a root cause",
      `defer(ack:Operator) why-chain: 1. why deferred — the walker cannot express it (cd-5.json:3) 2. why not — matcher predates AIDLC (audit.ts:44) 3. why unfixed — nobody re-minted it (git log) 4. root cause: the matcher outlived its scheme. owner: 01a0b421. ${LIVE}`,
    ],
    [
      "a chain marker carrying no whys at all",
      `defer(ack:Operator) why-chain: see the record ${LIVE}`,
    ],
    [
      "five bare ordinals with no reasoning",
      `defer(ack:Operator) why-chain 1. a 2. b 3. c 4. d 5. e ${LIVE}`,
    ],
    [
      "five reasoned whys that never reach a root cause",
      `defer(ack:Operator) why-chain: 1. the loader refused the entry 2. the matcher never matched it 3. the pattern predates the scheme 4. nobody re-minted the matcher 5. it was not noticed until now ${LIVE}`,
    ],
    [
      "five bare ordinals carrying a root-cause label",
      `defer(ack:Operator) why-chain 1. a 2. b 3. c 4. d 5. e root cause: x ${LIVE}`,
    ],
  ])("%s stays live", (_label, finding) => {
    expect(blockingFindingsIn([finding])).toEqual([finding]);
  });
});

describe("each numbered why carries an answered question and evidence", () => {
  test.each([
    ["first", "(port.ts:12)"],
    ["second", "(sdk.ts:8)"],
    ["third", "(schema.ts:1)"],
    ["fourth", "(PR #906)"],
    ["fifth", "(record 01a0b421)"],
  ])("the %s why without evidence stays live", (_step, citation) => {
    const finding = `defer(ack:Operator) ${WHY_CHAIN.replace(citation, "")}`;
    expect(blockingFindingsIn([finding])).toEqual([finding]);
  });

  test("repeated filler with a cause label and owner stays live", () => {
    const finding = `defer(ack:Operator) why-chain 1. ${"x".repeat(12)} 2. ${"x".repeat(12)} 3. ${"x".repeat(12)} 4. ${"x".repeat(12)} 5. root cause: the matcher outlived its scheme. owner: 01a0b421 (record 01a0b421). ${LIVE}`;
    expect(blockingFindingsIn([finding])).toEqual([finding]);
  });

  test("a missing fifth owner stays live", () => {
    const finding = `defer(ack:Operator) ${WHY_CHAIN.replace(/owner: capture 01a0b421/, "owner: ")}`;
    expect(blockingFindingsIn([finding])).toEqual([finding]);
  });

  test("cause and owner outside the fifth why stay live", () => {
    const finding = `defer(ack:Operator) ${WHY_CHAIN.replace("5. root cause:", "5. why did that survive? because no gate covered this seam (PR #906). 6. root cause:")}`;
    expect(blockingFindingsIn([finding])).toEqual([finding]);
  });
});

describe("a chain carrying MORE whys than required is still disposed", () => {
  const sevenWhyChain = [
    "defer(ack:Operator) why-chain:",
    "1. why deferred — the walker cannot express it (cd-5.json:3)",
    "2. why not — the matcher predates AIDLC ids (audit.ts:44)",
    "3. why unfixed — nobody re-minted it (git log --oneline)",
    "4. why unnoticed — no sensor covered the path (sensors/)",
    "5. root cause: the matcher outlived its scheme. owner: 01a0b421 (record 01a0b421).",
    "6. why still — the migration skipped it (PR #906)",
    "7. why still again — the migration skipped another seam (PR #906)",
    LIVE,
  ].join(" ");

  test("seven reasoned whys reaching a root cause are disposed", () => {
    expect(blockingFindingsIn([sevenWhyChain])).toEqual([]);
  });

  test("the ordinal pattern reaches the requirement's own last ordinal", () => {
    expect(REQUIRED_WHY_COUNT).toBeGreaterThan(0);
    const exactly = [
      "defer(ack:Operator) why-chain:",
      ...Array.from(
        { length: REQUIRED_WHY_COUNT - 1 },
        (_unused, index) =>
          `${index + 1}. why this step — a reasoned answer citing (file.ts:${index})`,
      ),
      `${REQUIRED_WHY_COUNT}. root cause: the matcher outlived its scheme. owner: 01a0b421 (record 01a0b421).`,
      LIVE,
    ].join(" ");
    expect(blockingFindingsIn([exactly])).toEqual([]);
  });
});

describe("a bare disposition word does NOT dispose a finding", () => {
  test.each([
    ["bare DEFERRED", `DEFERRED: ${LIVE}`],
    ["bare defer", `defer ${LIVE}`],
    ["bare FIXED with no sha", `FIXED: ${LIVE}`],
    ["bare RESOLVED with no sha", `RESOLVED ${LIVE}`],
    ["bare WITHDRAWN with nothing after it", "WITHDRAWN"],
    [
      "push-back whose only 'ground' is the finding's own coordinate",
      `push-back: ${LIVE}`,
    ],
    ["defer whose only 'ack' is the finding's own text", `DEFERRED: ${LIVE}`],
    ["push-back with empty parens", `push-back() ${LIVE}`],
    ["defer with whitespace-only parens", `defer(   ) ${LIVE}`],
    [
      "withdrawn whose only 'reason' is the finding's own text",
      `WITHDRAWN: ${LIVE}`,
    ],
    ["withdrawn with empty parens", `withdrawn() ${LIVE}`],
  ])("%s stays blocking", (_label, finding) => {
    expect(blockingFindingsIn([finding])).toEqual([finding]);
  });
});

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
