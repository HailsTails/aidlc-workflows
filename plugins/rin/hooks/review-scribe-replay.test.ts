import { describe, expect, type Mock, test, vi } from "vitest";
import { ZodError } from "zod";
import {
  aggregateVerdictAt,
  buildScribeCheckout,
  type ReviewedRecord,
  removeScribeCheckout,
  replayLensStops,
  type ScribeCheckout,
  type ScribeCheckoutFiles,
  type ScribeRunner,
  type SubagentStopPayloadBuilder,
  verdictMessage,
} from "./review-scribe-replay.ts";

const HEAD_SHA = "0123456789abcdef0123456789abcdef01234567";
const INTERFACE_LOCK_RECORD: ReviewedRecord = {
  gate: "rin-gate-3-interface-lock",
  recordName: "260101-replayed",
  headSha: HEAD_SHA,
};
const IMPLEMENT_RECORD: ReviewedRecord = {
  gate: "rin-gate-4-implement",
  recordName: "260101-replayed",
  headSha: HEAD_SHA,
};
const FIXTURE_SCRIBE_CHECKOUT: ScribeCheckout = {
  root: "/checkout",
  reviewedRecord: INTERFACE_LOCK_RECORD,
  rosterConfigPath: "/checkout/review-rosters.json",
  engineLogPath: "/checkout/fake-aidlc-log.ts",
  reviewTracePath: "/checkout/trace.jsonl",
  discardLedgerPath: "/checkout/discards.jsonl",
  capturesDirectory: "/checkout/captures",
};
const SCRIBE_PATH = "/hooks/rin-gates-review-scribe.ts";
const BASE_ENVIRONMENT: Readonly<Record<string, string>> = {
  ["PATH"]: "/bin",
  ["RIN_GATES_TEST_MODE"]: "0",
  ["RIN_GATES_HEAD_SHA"]: "stale-sha",
};
const SCRIBE_ENVIRONMENT: Readonly<Record<string, string>> = {
  ["PATH"]: "/bin",
  ["RIN_GATES_TEST_MODE"]: "1",
  ["RIN_GATES_HEAD_SHA"]: "0123456789abcdef0123456789abcdef01234567",
  ["RIN_GATES_SPACE"]: "default",
  ["RIN_GATES_REVIEW_TRACE_PATH"]: "/checkout/trace.jsonl",
  ["RIN_GATES_REVIEW_DISCARD_LEDGER_PATH"]: "/checkout/discards.jsonl",
  ["RIN_GATES_REVIEW_CAPTURES_DIR"]: "/checkout/captures",
  ["RIN_GATES_ROSTER_CONFIG"]: "/checkout/review-rosters.json",
  ["RIN_GATES_ENGINE_LOG_PATH"]: "/checkout/fake-aidlc-log.ts",
};

type FakeFiles = {
  readonly files: ScribeCheckoutFiles;
  readonly makeDirectory: Mock<ScribeCheckoutFiles["makeDirectory"]>;
  readonly writeText: Mock<ScribeCheckoutFiles["writeText"]>;
  readonly readText: Mock<ScribeCheckoutFiles["readText"]>;
  readonly removeTree: Mock<ScribeCheckoutFiles["removeTree"]>;
};

const fakeFiles = (): FakeFiles => {
  const makeDirectory = vi.fn<ScribeCheckoutFiles["makeDirectory"]>();
  const writeText = vi.fn<ScribeCheckoutFiles["writeText"]>();
  const readText = vi.fn<ScribeCheckoutFiles["readText"]>();
  const removeTree = vi.fn<ScribeCheckoutFiles["removeTree"]>();
  return {
    files: {
      makeScratchDirectory: vi
        .fn<ScribeCheckoutFiles["makeScratchDirectory"]>()
        .mockReturnValue("/scratch"),
      makeDirectory,
      writeText,
      readText,
      removeTree,
    },
    makeDirectory,
    writeText,
    readText,
    removeTree,
  };
};

describe("verdictMessage", () => {
  test("a READY verdict names the reviewed head", () => {
    expect(verdictMessage({ verdict: "READY", headSha: "abc" })).toBe(
      "## Verdict\n\nREADY — reviewed at abc.",
    );
  });

  test("a NOT-READY verdict carries no head", () => {
    expect(verdictMessage({ verdict: "NOT-READY", headSha: "abc" })).toBe(
      "## Verdict\n\nNOT-READY",
    );
  });
});

describe("buildScribeCheckout", () => {
  test("returns the checkout rooted at a fresh scratch directory, naming every path the scribe is given", () => {
    const { files } = fakeFiles();

    expect(
      buildScribeCheckout({
        reviewedRecord: INTERFACE_LOCK_RECORD,
        roster: ["lens-one"],
        files,
      }),
    ).toEqual({
      root: "/scratch",
      reviewedRecord: INTERFACE_LOCK_RECORD,
      rosterConfigPath: "/scratch/review-rosters.json",
      engineLogPath: "/scratch/fake-aidlc-log.ts",
      reviewTracePath: "/scratch/trace.jsonl",
      discardLedgerPath: "/scratch/discards.jsonl",
      capturesDirectory: "/scratch/captures",
    });
  });

  test("makes the record directory and a .git marker", () => {
    const { files, makeDirectory } = fakeFiles();

    buildScribeCheckout({
      reviewedRecord: INTERFACE_LOCK_RECORD,
      roster: ["lens-one"],
      files,
    });

    expect(makeDirectory.mock.calls).toEqual([
      [{ path: "/scratch/aidlc/spaces/default/intents/260101-replayed" }],
      [{ path: "/scratch/.git" }],
    ]);
  });

  test("writes the active intent, the record at the reviewed gate, the roster for that gate, and an empty engine log", () => {
    const { files, writeText } = fakeFiles();

    buildScribeCheckout({
      reviewedRecord: INTERFACE_LOCK_RECORD,
      roster: ["lens-one", "lens-two"],
      files,
    });

    expect(writeText.mock.calls).toEqual([
      [
        {
          path: "/scratch/aidlc/spaces/default/intents/active-intent",
          text: "260101-replayed",
        },
      ],
      [
        {
          path: "/scratch/aidlc/spaces/default/intents/260101-replayed/aidlc-state.md",
          text: "**Current Stage**: rin-gate-3-interface-lock\n",
        },
      ],
      [
        {
          path: "/scratch/review-rosters.json",
          text: '{"defaultRoster":["lens-one","lens-two"],"byGate":{"rin-gate-3-interface-lock":["lens-one","lens-two"]}}',
        },
      ],
      [{ path: "/scratch/fake-aidlc-log.ts", text: "" }],
    ]);
  });
});

describe("removeScribeCheckout", () => {
  test("removes the checkout's root tree", () => {
    const { files, removeTree } = fakeFiles();

    removeScribeCheckout({ checkout: FIXTURE_SCRIBE_CHECKOUT, files });

    expect(removeTree.mock.calls).toEqual([[{ path: "/checkout" }]]);
  });
});

describe("replayLensStops", () => {
  test("runs the scribe once per capture, in capture order, returning each exit code in turn", async () => {
    const runScribe = vi
      .fn<ScribeRunner>()
      .mockResolvedValueOnce({ exitCode: 1 })
      .mockResolvedValueOnce({ exitCode: 2 });
    const subagentStopPayloadOf = vi
      .fn<SubagentStopPayloadBuilder>()
      .mockReturnValue("payload");

    expect(
      await replayLensStops({
        replay: {
          checkout: FIXTURE_SCRIBE_CHECKOUT,
          scribePath: SCRIBE_PATH,
          sessionId: "session-1",
          baseEnvironment: BASE_ENVIRONMENT,
          runScribe,
          subagentStopPayloadOf,
        },
        captures: [
          { lens: "lens-one", verdict: "READY" },
          { lens: "lens-two", verdict: "NOT-READY" },
        ],
      }),
    ).toEqual([1, 2]);
  });

  test("builds each capture's SubagentStop from its lens, its verdict message, the checkout root and the session", async () => {
    const runScribe = vi
      .fn<ScribeRunner>()
      .mockResolvedValueOnce({ exitCode: 0 })
      .mockResolvedValueOnce({ exitCode: 0 });
    const subagentStopPayloadOf = vi
      .fn<SubagentStopPayloadBuilder>()
      .mockReturnValueOnce("payload-one")
      .mockReturnValueOnce("payload-two");

    await replayLensStops({
      replay: {
        checkout: FIXTURE_SCRIBE_CHECKOUT,
        scribePath: SCRIBE_PATH,
        sessionId: "session-1",
        baseEnvironment: BASE_ENVIRONMENT,
        runScribe,
        subagentStopPayloadOf,
      },
      captures: [
        { lens: "lens-one", verdict: "READY" },
        { lens: "lens-two", verdict: "NOT-READY" },
      ],
    });

    expect(subagentStopPayloadOf.mock.calls).toEqual([
      [
        {
          agentType: "lens-one",
          lastAssistantMessage:
            "## Verdict\n\nREADY — reviewed at 0123456789abcdef0123456789abcdef01234567.",
          cwd: "/checkout",
          sessionId: "session-1",
        },
      ],
      [
        {
          agentType: "lens-two",
          lastAssistantMessage: "## Verdict\n\nNOT-READY",
          cwd: "/checkout",
          sessionId: "session-1",
        },
      ],
    ]);
  });

  test("hands the scribe each built payload under the base environment, the scribe's variables overriding it", async () => {
    const runScribe = vi
      .fn<ScribeRunner>()
      .mockResolvedValueOnce({ exitCode: 0 })
      .mockResolvedValueOnce({ exitCode: 0 });
    const subagentStopPayloadOf = vi
      .fn<SubagentStopPayloadBuilder>()
      .mockReturnValueOnce("payload-one")
      .mockReturnValueOnce("payload-two");

    await replayLensStops({
      replay: {
        checkout: FIXTURE_SCRIBE_CHECKOUT,
        scribePath: SCRIBE_PATH,
        sessionId: "session-1",
        baseEnvironment: BASE_ENVIRONMENT,
        runScribe,
        subagentStopPayloadOf,
      },
      captures: [
        { lens: "lens-one", verdict: "READY" },
        { lens: "lens-two", verdict: "NOT-READY" },
      ],
    });

    expect(runScribe.mock.calls).toEqual([
      [
        {
          scribePath: "/hooks/rin-gates-review-scribe.ts",
          environment: SCRIBE_ENVIRONMENT,
          stdinPayload: "payload-one",
        },
      ],
      [
        {
          scribePath: "/hooks/rin-gates-review-scribe.ts",
          environment: SCRIBE_ENVIRONMENT,
          stdinPayload: "payload-two",
        },
      ],
    ]);
  });

  test("replays nothing for no captures", async () => {
    const runScribe = vi.fn<ScribeRunner>();

    expect(
      await replayLensStops({
        replay: {
          checkout: FIXTURE_SCRIBE_CHECKOUT,
          scribePath: SCRIBE_PATH,
          sessionId: "session-1",
          baseEnvironment: BASE_ENVIRONMENT,
          runScribe,
          subagentStopPayloadOf: vi.fn<SubagentStopPayloadBuilder>(),
        },
        captures: [],
      }),
    ).toEqual([]);
    expect(runScribe.mock.calls).toEqual([]);
  });
});

describe("aggregateVerdictAt", () => {
  test("reads an inception gate's verdict from the inception phase directory", () => {
    const { files, readText } = fakeFiles();
    readText.mockReturnValueOnce(
      '{"verdict":"READY","blockingFindings":[],"headSha":"0123456789abcdef0123456789abcdef01234567","lenses":["lens-one"]}',
    );

    expect(
      aggregateVerdictAt({ checkout: FIXTURE_SCRIBE_CHECKOUT, files }),
    ).toEqual({
      verdict: "READY",
      blockingFindings: [],
      headSha: HEAD_SHA,
    });
    expect(readText.mock.calls).toEqual([
      [
        {
          path: "/checkout/aidlc/spaces/default/intents/260101-replayed/inception/rin-gate-3-interface-lock/review-verdict.json",
        },
      ],
    ]);
  });

  test("reads a construction gate's verdict from the construction phase directory", () => {
    const { files, readText } = fakeFiles();
    readText.mockReturnValueOnce(
      '{"verdict":"NOT-READY","blockingFindings":["lens-one: F1"],"headSha":"0123456789abcdef0123456789abcdef01234567"}',
    );

    expect(
      aggregateVerdictAt({
        checkout: {
          ...FIXTURE_SCRIBE_CHECKOUT,
          reviewedRecord: IMPLEMENT_RECORD,
        },
        files,
      }),
    ).toEqual({
      verdict: "NOT-READY",
      blockingFindings: ["lens-one: F1"],
      headSha: HEAD_SHA,
    });
    expect(readText.mock.calls).toEqual([
      [
        {
          path: "/checkout/aidlc/spaces/default/intents/260101-replayed/construction/rin-gate-4-implement/review-verdict.json",
        },
      ],
    ]);
  });

  test("refuses, as a schema failure, an aggregate whose verdict is outside READY and NOT-READY", () => {
    const { files, readText } = fakeFiles();
    readText.mockReturnValueOnce(
      '{"verdict":"MAYBE","blockingFindings":[],"headSha":"0123456789abcdef0123456789abcdef01234567"}',
    );

    expect(() =>
      aggregateVerdictAt({ checkout: FIXTURE_SCRIBE_CHECKOUT, files }),
    ).toThrow(ZodError);
  });
});
