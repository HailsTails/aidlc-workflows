import { z } from "zod";
import { defaultPathOperations } from "../rin-harness-path-operations.ts";
import type { ReplayResult } from "./review-history-replay.ts";
import {
  replayAgainstInstalledScribe,
  type ScribeInstallation,
} from "./review-history-replay-gate.ts";
import { defaultReviewProcessPort } from "./review-process-port.ts";

const HISTORY_FLAG = "--history";
const BOUNDED_CLOSE_FLAG = "--bounded-close";
const FORWARD_GATE_FLAG = "--forward-gate";
const USAGE =
  "usage: review-history-replay-cli --history <review history json> --bounded-close <off|this-record> --forward-gate <later gate>";
const SUCCEEDED = 0;
const REFUSED = 1;

const replayRequestSchema = z.object({
  historyPath: z.string().min(1),
  boundedClose: z.enum(["off", "this-record"]),
  forwardGate: z.string().min(1),
});

type ReplayRequest = z.infer<typeof replayRequestSchema>;

type ReplayCommand = {
  readonly args: readonly string[];
  readonly installation: ScribeInstallation;
  readonly replay: (
    request: ReplayRequest & { readonly installation: ScribeInstallation },
  ) => Promise<ReplayResult>;
  readonly publish: (text: string) => void;
  readonly diagnose: (text: string) => void;
};

const valueAfter = ({
  args,
  flag,
}: {
  readonly args: readonly string[];
  readonly flag: string;
}): string | undefined => {
  const position = args.indexOf(flag);
  return position < 0 ? undefined : args[position + 1];
};

const replayRequestOf = ({
  args,
}: {
  readonly args: readonly string[];
}): ReplayRequest | null => {
  const parsed = replayRequestSchema.safeParse({
    historyPath: valueAfter({ args, flag: HISTORY_FLAG }),
    boundedClose: valueAfter({ args, flag: BOUNDED_CLOSE_FLAG }),
    forwardGate: valueAfter({ args, flag: FORWARD_GATE_FLAG }),
  });
  return parsed.success ? parsed.data : null;
};

const scribeInstallationUnder = ({
  harnessDirectory,
  repository,
  join,
}: {
  readonly harnessDirectory: string;
  readonly repository: string;
  readonly join: (...segments: string[]) => string;
}): ScribeInstallation => ({
  scribe: join(harnessDirectory, "hooks", "rin-gates-review-scribe.ts"),
  rosterConfig: join(harnessDirectory, "hooks", "review-rosters.json"),
  stageGraph: join(harnessDirectory, "tools", "data", "stage-graph.json"),
  harnessConfig: join(repository, "harness.config.json"),
});

const runReplay = async ({
  args,
  installation,
  replay,
  publish,
  diagnose,
}: ReplayCommand): Promise<number> => {
  const request = replayRequestOf({ args });
  if (request === null) {
    diagnose(`${USAGE}\n`);
    return REFUSED;
  }
  const result = await replay({ ...request, installation });
  publish(`${JSON.stringify(result, null, 2)}\n`);
  return SUCCEEDED;
};

if (import.meta.main) {
  const runtime = defaultReviewProcessPort();
  const paths = defaultPathOperations();
  const join = (...segments: string[]): string => paths.join({ segments });
  const toolsDirectory = paths.dirname({
    path: paths.dirname({ path: paths.fromFileUrl({ url: import.meta.url }) }),
  });
  runtime.exit(
    await runReplay({
      args: runtime.arguments.slice(2),
      installation: scribeInstallationUnder({
        harnessDirectory: paths.dirname({ path: toolsDirectory }),
        repository: paths.resolve({ segments: ["."] }),
        join,
      }),
      replay: replayAgainstInstalledScribe,
      publish: runtime.publish,
      diagnose: runtime.diagnose,
    }),
  );
}

export {
  type ReplayCommand,
  type ReplayRequest,
  replayRequestOf,
  runReplay,
  scribeInstallationUnder,
};
