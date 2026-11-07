import { z } from "zod";
import {
  BOARD_VERDICT_TOKENS,
  type BoardVerdictToken,
  GATE_PHASES,
  type GateSlug,
  REVIEW_VERDICT_FILENAME,
} from "../tools/rin-gates/rin-gate-namespace.ts";

type ScribeCheckoutFiles = {
  readonly makeScratchDirectory: () => string;
  readonly makeDirectory: (request: { readonly path: string }) => void;
  readonly writeText: (request: {
    readonly path: string;
    readonly text: string;
  }) => void;
  readonly readText: (request: { readonly path: string }) => string;
  readonly removeTree: (request: { readonly path: string }) => void;
};

type LensCapture = {
  readonly lens: string;
  readonly verdict: BoardVerdictToken;
};

type ReviewedRecord = {
  readonly gate: GateSlug;
  readonly recordName: string;
  readonly headSha: string;
};

type ScribeCheckout = {
  readonly root: string;
  readonly reviewedRecord: ReviewedRecord;
  readonly rosterConfigPath: string;
  readonly engineLogPath: string;
  readonly reviewTracePath: string;
  readonly discardLedgerPath: string;
  readonly capturesDirectory: string;
};

type LensStop = {
  readonly scribePath: string;
  readonly environment: Readonly<Record<string, string>>;
  readonly stdinPayload: string;
};

type ScribeRunner = (lensStop: LensStop) => Promise<{
  readonly exitCode: number;
}>;

type SubagentStopPayloadBuilder = (subagentStop: {
  readonly agentType: string;
  readonly lastAssistantMessage: string;
  readonly cwd: string;
  readonly sessionId: string;
}) => string;

type LensStopReplay = {
  readonly checkout: ScribeCheckout;
  readonly scribePath: string;
  readonly sessionId: string;
  readonly baseEnvironment: Readonly<Record<string, string>>;
  readonly runScribe: ScribeRunner;
  readonly subagentStopPayloadOf: SubagentStopPayloadBuilder;
};

const aggregateVerdictSchema = z.object({
  verdict: z.enum(BOARD_VERDICT_TOKENS),
  blockingFindings: z.array(z.string()),
  headSha: z.string(),
});

type AggregateVerdict = z.infer<typeof aggregateVerdictSchema>;

const intentsDirectoryOf = ({ root }: { readonly root: string }): string =>
  `${root}/aidlc/spaces/default/intents`;

const recordDirectoryOf = ({
  root,
  reviewedRecord,
}: {
  readonly root: string;
  readonly reviewedRecord: ReviewedRecord;
}): string => `${intentsDirectoryOf({ root })}/${reviewedRecord.recordName}`;

const verdictMessage = ({
  verdict,
  headSha,
}: {
  readonly verdict: BoardVerdictToken;
  readonly headSha: string;
}): string => {
  switch (verdict) {
    case "READY":
      return `## Verdict\n\nREADY — reviewed at ${headSha}.`;
    case "NOT-READY":
      return "## Verdict\n\nNOT-READY";
  }
};

const buildScribeCheckout = ({
  reviewedRecord,
  roster,
  files,
}: {
  readonly reviewedRecord: ReviewedRecord;
  readonly roster: readonly string[];
  readonly files: ScribeCheckoutFiles;
}): ScribeCheckout => {
  const root = files.makeScratchDirectory();
  const recordDirectory = recordDirectoryOf({ root, reviewedRecord });
  const checkout: ScribeCheckout = {
    root,
    reviewedRecord,
    rosterConfigPath: `${root}/review-rosters.json`,
    engineLogPath: `${root}/fake-aidlc-log.ts`,
    reviewTracePath: `${root}/trace.jsonl`,
    discardLedgerPath: `${root}/discards.jsonl`,
    capturesDirectory: `${root}/captures`,
  };
  files.makeDirectory({ path: recordDirectory });
  files.makeDirectory({ path: `${root}/.git` });
  files.writeText({
    path: `${intentsDirectoryOf({ root })}/active-intent`,
    text: reviewedRecord.recordName,
  });
  files.writeText({
    path: `${recordDirectory}/aidlc-state.md`,
    text: `**Current Stage**: ${reviewedRecord.gate}\n`,
  });
  files.writeText({
    path: checkout.rosterConfigPath,
    text: JSON.stringify({
      defaultRoster: roster,
      byGate: { [reviewedRecord.gate]: roster },
    }),
  });
  files.writeText({ path: checkout.engineLogPath, text: "" });
  return checkout;
};

const removeScribeCheckout = ({
  checkout,
  files,
}: {
  readonly checkout: ScribeCheckout;
  readonly files: ScribeCheckoutFiles;
}): void => {
  files.removeTree({ path: checkout.root });
};

const scribeEnvironment = ({
  checkout,
}: {
  readonly checkout: ScribeCheckout;
}): Readonly<Record<string, string>> =>
  Object.fromEntries([
    ["RIN_GATES_TEST_MODE", "1"],
    ["RIN_GATES_HEAD_SHA", checkout.reviewedRecord.headSha],
    ["RIN_GATES_SPACE", "default"],
    ["RIN_GATES_REVIEW_TRACE_PATH", checkout.reviewTracePath],
    ["RIN_GATES_REVIEW_DISCARD_LEDGER_PATH", checkout.discardLedgerPath],
    ["RIN_GATES_REVIEW_CAPTURES_DIR", checkout.capturesDirectory],
    ["RIN_GATES_ROSTER_CONFIG", checkout.rosterConfigPath],
    ["RIN_GATES_ENGINE_LOG_PATH", checkout.engineLogPath],
  ]);

const lensStopFor = ({
  replay,
  capture,
}: {
  readonly replay: LensStopReplay;
  readonly capture: LensCapture;
}): LensStop => ({
  scribePath: replay.scribePath,
  environment: {
    ...replay.baseEnvironment,
    ...scribeEnvironment({ checkout: replay.checkout }),
  },
  stdinPayload: replay.subagentStopPayloadOf({
    agentType: capture.lens,
    lastAssistantMessage: verdictMessage({
      verdict: capture.verdict,
      headSha: replay.checkout.reviewedRecord.headSha,
    }),
    cwd: replay.checkout.root,
    sessionId: replay.sessionId,
  }),
});

const replayLensStop = async ({
  replay,
  capture,
}: {
  readonly replay: LensStopReplay;
  readonly capture: LensCapture;
}): Promise<number> => {
  const outcome = await replay.runScribe(lensStopFor({ replay, capture }));
  return outcome.exitCode;
};

const replayLensStops = ({
  replay,
  captures,
}: {
  readonly replay: LensStopReplay;
  readonly captures: readonly LensCapture[];
}): Promise<readonly number[]> =>
  captures.reduce<Promise<readonly number[]>>(
    (priorExitCodes, capture) =>
      priorExitCodes.then(async (exitCodes) => [
        ...exitCodes,
        await replayLensStop({ replay, capture }),
      ]),
    Promise.resolve([]),
  );

const aggregateVerdictPathOf = ({
  checkout,
}: {
  readonly checkout: ScribeCheckout;
}): string => {
  const { gate } = checkout.reviewedRecord;
  const recordDirectory = recordDirectoryOf({
    root: checkout.root,
    reviewedRecord: checkout.reviewedRecord,
  });
  return `${recordDirectory}/${GATE_PHASES[gate]}/${gate}/${REVIEW_VERDICT_FILENAME}`;
};

const aggregateVerdictAt = ({
  checkout,
  files,
}: {
  readonly checkout: ScribeCheckout;
  readonly files: ScribeCheckoutFiles;
}): AggregateVerdict =>
  aggregateVerdictSchema.parse(
    JSON.parse(files.readText({ path: aggregateVerdictPathOf({ checkout }) })),
  );

export {
  type AggregateVerdict,
  aggregateVerdictAt,
  buildScribeCheckout,
  type LensCapture,
  type LensStop,
  type LensStopReplay,
  type ReviewedRecord,
  removeScribeCheckout,
  replayLensStops,
  type ScribeCheckout,
  type ScribeCheckoutFiles,
  type ScribeRunner,
  type SubagentStopPayloadBuilder,
  verdictMessage,
};
