import { z } from "zod";
import { defaultPathOperations } from "../rin-harness-path-operations.ts";
import { defaultFileTextPort } from "../rin-harness-sidecar-file-reader.ts";
import { defaultReviewDecodersPort } from "./review-decoders-port.ts";
import {
  type GateVerdict,
  type HandBack,
  type ReplayGate,
  type ReplayResult,
  replayReviewHistory,
  reviewHistoryOf,
} from "./review-history-replay.ts";
import { defaultReviewProcessPort } from "./review-process-port.ts";
import {
  GATE_PHASES,
  type GateSlug,
  isGateSlug,
} from "./rin-gate-namespace.ts";
import {
  CLOSE_RECEIPT_FILENAME,
  type CloseReceipt,
} from "./rin-gates-bounded-close.ts";

const SCRIBE_OWNED_VARIABLE_PREFIX = "RIN_GATES_";
const VERDICT_FILENAME = "review-verdict.json";
const NO_VERDICT_WRITTEN: GateVerdict = {
  verdict: "NONE",
  headSha: "",
  findings: [],
  blockingFindings: [],
  lenses: [],
  isClosedByReceipt: false,
};

const verdictSchema = z
  .object({
    verdict: z.string(),
    headSha: z.string(),
    findings: z.array(z.string()),
    blockingFindings: z.array(z.string()),
    lenses: z.array(z.string()),
    boundedClose: z.unknown().optional(),
  })
  .transform(
    ({ boundedClose, ...verdict }): GateVerdict => ({
      ...verdict,
      isClosedByReceipt: boundedClose !== undefined,
    }),
  );
const configSchema = z.record(z.string(), z.unknown());
const gateSlugSchema = z.custom<GateSlug>(
  (gate) => typeof gate === "string" && isGateSlug(gate),
);

type BoundedCloseSetting =
  | "off"
  | "all"
  | { readonly records: readonly string[] };

type ScribeInstallation = {
  readonly scribe: string;
  readonly rosterConfig: string;
  readonly stageGraph: string;
  readonly harnessConfig: string;
};

type ScribeRun = {
  readonly scribe: string;
  readonly environment: Readonly<Record<string, string>>;
  readonly input: string;
};

type ReplayGatePorts = {
  readonly join: (...segments: string[]) => string;
  readonly createTemporaryDirectory: () => string;
  readonly createDirectory: (path: string) => void;
  readonly removeDirectory: (path: string) => void;
  readonly writeText: (path: string, text: string) => void;
  readonly readText: (path: string) => string | undefined;
  readonly ambientEnvironment: Readonly<Record<string, string | undefined>>;
  readonly runScribe: (run: ScribeRun) => Promise<string>;
  readonly decodeReceipt: (candidate: unknown) => CloseReceipt | null;
};

type InstalledScribeGate = ReplayGate & {
  readonly carryReceipt: (receipt: CloseReceipt) => void;
  readonly reviewTrace: () => string | undefined;
  readonly dispose: () => void;
};

const defaultReplayGatePorts = (): ReplayGatePorts => {
  const paths = defaultPathOperations();
  const files = defaultFileTextPort();
  const runtime = defaultReviewProcessPort();
  const decoders = defaultReviewDecodersPort();
  const join = (...segments: string[]): string => paths.join({ segments });
  return {
    join,
    createTemporaryDirectory: () =>
      files.makeTemporaryDirectory(
        join(files.temporaryRoot(), "rin-review-history-replay-"),
      ),
    createDirectory: (path) => files.mkdir(path, { recursive: true }),
    removeDirectory: (path) =>
      files.remove(path, { recursive: true, force: true }),
    writeText: (path, text) => files.write(path, text),
    readText: (path) => (files.exists(path) ? files.read(path) : undefined),
    ambientEnvironment: runtime.environment,
    runScribe: async ({ scribe, environment, input }) => {
      const result = await runtime.run({
        program: "bun",
        args: [scribe],
        environment,
        input,
      });
      return result.stderr;
    },
    decodeReceipt: (candidate) => {
      const decoded = decoders.closeReceipt(candidate);
      return decoded.success ? decoded.data : null;
    },
  };
};

const environmentWithoutScribeVariables = ({
  ambientEnvironment,
}: {
  readonly ambientEnvironment: Readonly<Record<string, string | undefined>>;
}): Record<string, string> =>
  Object.fromEntries(
    Object.entries(ambientEnvironment).flatMap(([name, setting]) =>
      setting === undefined || name.startsWith(SCRIBE_OWNED_VARIABLE_PREFIX)
        ? []
        : [[name, setting]],
    ),
  );

type Checkout = {
  readonly root: string;
  readonly recordDirectory: string;
};

type ReplayedGate = {
  readonly record: string;
  readonly gate: GateSlug;
  readonly boundedClose: BoundedCloseSetting;
  readonly installation: ScribeInstallation;
  readonly ports: ReplayGatePorts;
};

const gateDirectoryOf = ({
  checkout,
  gate,
  ports,
}: {
  readonly checkout: Checkout;
  readonly gate: GateSlug;
  readonly ports: ReplayGatePorts;
}): string => ports.join(checkout.recordDirectory, GATE_PHASES[gate], gate);

const seedCheckout = ({
  record,
  gate,
  boundedClose,
  installation,
  ports,
}: ReplayedGate): Checkout => {
  const { join } = ports;
  const root = ports.createTemporaryDirectory();
  const intents = join(root, "aidlc", "spaces", "default", "intents");
  const checkout = { root, recordDirectory: join(intents, record) };
  ports.createDirectory(gateDirectoryOf({ checkout, gate, ports }));
  ports.createDirectory(join(root, ".git"));
  ports.writeText(join(intents, "active-intent"), record);
  ports.writeText(
    join(checkout.recordDirectory, "aidlc-state.md"),
    `**Current Stage**: ${gate}\n`,
  );
  const installedConfig = configSchema.parse(
    JSON.parse(ports.readText(installation.harnessConfig) ?? "{}"),
  );
  ports.writeText(
    join(root, "harness.config.json"),
    JSON.stringify({
      ...installedConfig,
      rinGates: {
        ...configSchema.parse(installedConfig["rinGates"] ?? {}),
        oneBoardBoundedClose: boundedClose,
      },
    }),
  );
  ports.writeText(join(root, "engine-log.ts"), "");
  return checkout;
};

const scribeEnvironmentOf = ({
  headSha,
  checkout,
  installation,
  ports,
}: {
  readonly headSha: string;
  readonly checkout: Checkout;
  readonly installation: ScribeInstallation;
  readonly ports: ReplayGatePorts;
}): Record<string, string> => ({
  ...environmentWithoutScribeVariables({
    ambientEnvironment: ports.ambientEnvironment,
  }),
  ["RIN_GATES_TEST_MODE"]: "1",
  ["RIN_GATES_SPACE"]: "default",
  ["RIN_GATES_HEAD_SHA"]: headSha,
  ["RIN_GATES_REVIEW_TRACE_PATH"]: ports.join(checkout.root, "trace.jsonl"),
  ["RIN_GATES_REVIEW_DISCARD_LEDGER_PATH"]: ports.join(
    checkout.root,
    "discards.jsonl",
  ),
  ["RIN_GATES_REVIEW_HANDBACK_LEDGER_PATH"]: ports.join(
    checkout.root,
    "handbacks.jsonl",
  ),
  ["RIN_GATES_REVIEW_CAPTURES_DIR"]: ports.join(checkout.root, "captures"),
  ["RIN_GATES_ENGINE_LOG_PATH"]: ports.join(checkout.root, "engine-log.ts"),
  ["RIN_GATES_ROSTER_CONFIG"]: installation.rosterConfig,
  ["AIDLC_STAGE_GRAPH"]: installation.stageGraph,
});

const installedScribeGate = (replayed: ReplayedGate): InstalledScribeGate => {
  const { gate, installation, ports } = replayed;
  const checkout = seedCheckout(replayed);
  const gateDirectory = gateDirectoryOf({ checkout, gate, ports });
  return {
    handBack: ({ lens, headSha, message }: HandBack) =>
      ports.runScribe({
        scribe: installation.scribe,
        environment: scribeEnvironmentOf({
          headSha,
          checkout,
          installation,
          ports,
        }),
        input: JSON.stringify({
          ["agent_type"]: lens,
          ["agent_id"]: `${lens}-${headSha}`,
          ["last_assistant_message"]: message,
          cwd: checkout.root,
          ["session_id"]: "review-history-replay",
        }),
      }),
    verdict: () => {
      const text = ports.readText(ports.join(gateDirectory, VERDICT_FILENAME));
      return text === undefined
        ? NO_VERDICT_WRITTEN
        : verdictSchema.parse(JSON.parse(text));
    },
    receipt: () => {
      const text = ports.readText(
        ports.join(gateDirectory, CLOSE_RECEIPT_FILENAME),
      );
      return text === undefined ? null : ports.decodeReceipt(JSON.parse(text));
    },
    carryReceipt: (receipt) => {
      const earlierGateDirectory = gateDirectoryOf({
        checkout,
        gate: receipt.gate,
        ports,
      });
      ports.createDirectory(earlierGateDirectory);
      ports.writeText(
        ports.join(earlierGateDirectory, CLOSE_RECEIPT_FILENAME),
        JSON.stringify(receipt),
      );
    },
    reviewTrace: () => ports.readText(ports.join(checkout.root, "trace.jsonl")),
    dispose: () => ports.removeDirectory(checkout.root),
  };
};

const replayAgainstInstalledScribe = async ({
  historyPath,
  boundedClose,
  forwardGate,
  installation,
  ports = defaultReplayGatePorts(),
}: {
  readonly historyPath: string;
  readonly boundedClose: "off" | "this-record";
  readonly forwardGate: string;
  readonly installation: ScribeInstallation;
  readonly ports?: ReplayGatePorts;
}): Promise<ReplayResult> => {
  const history = reviewHistoryOf({
    text: ports.readText(historyPath) ?? "",
  });
  const gate = installedScribeGate({
    record: history.record,
    gate: gateSlugSchema.parse(history.gate),
    boundedClose:
      boundedClose === "off" ? "off" : { records: [history.record] },
    installation,
    ports,
  });
  try {
    return await replayReviewHistory({ history, forwardGate, gate });
  } finally {
    gate.dispose();
  }
};

export {
  type BoundedCloseSetting,
  defaultReplayGatePorts,
  type InstalledScribeGate,
  installedScribeGate,
  type ReplayGatePorts,
  replayAgainstInstalledScribe,
  type ScribeInstallation,
  type ScribeRun,
};
