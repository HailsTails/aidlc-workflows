import { appendFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type GitBasis, gitBasis } from "./rin-harness-git.ts";

type GateVerdict = {
  readonly pass: boolean;
  readonly violationsCount: number;
  readonly decayPass: boolean;
  readonly decayViolationsCount: number;
};

type GateRunRecord = {
  readonly kind: "gate-completion";
  readonly ts: string;
  readonly stage: string;
  readonly result: string;
  readonly command: string;
  readonly verdict: GateVerdict;
  readonly basis: GitBasis;
};

const GATE_RUNS_DIR = ".gate-runs";
const RUNS_FILE = "runs.jsonl";
const OUTPUT_TAIL_LENGTH = 4000;

const sanitizeUnit = ({ stage }: { readonly stage: string }): string => {
  const cleaned = stage.replace(/[^A-Za-z0-9._-]/g, "-").replace(/^-+/, "");
  return cleaned.length === 0 ? "ungrouped" : cleaned;
};

const appendGateRun = ({
  projectDir,
  stage,
  result,
  command,
  verdict,
  timestamp,
}: {
  readonly projectDir: string;
  readonly stage: string;
  readonly result: string;
  readonly command: string;
  readonly verdict: GateVerdict;
  readonly timestamp: string;
}): { readonly written: boolean; readonly path: string } => {
  const unit = sanitizeUnit({ stage });
  const evidenceDir = join(projectDir, GATE_RUNS_DIR, unit);
  const runsPath = join(evidenceDir, RUNS_FILE);
  const record: GateRunRecord = {
    kind: "gate-completion",
    ts: timestamp,
    stage,
    result,
    command: command.slice(0, OUTPUT_TAIL_LENGTH),
    verdict,
    basis: gitBasis({ projectDir }),
  };
  const attempt = ((): boolean => {
    const written = (() => {
      mkdirSync(evidenceDir, { recursive: true });
      appendFileSync(runsPath, `${JSON.stringify(record)}\n`);
      return true;
    })();
    return written;
  })();
  return { written: attempt, path: runsPath };
};

const parseFlag = ({
  argv,
  flag,
}: {
  readonly argv: readonly string[];
  readonly flag: string;
}): string | undefined => {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
};

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const projectDir = resolve(
    parseFlag({ argv, flag: "--project-dir" }) ??
      process.env.CLAUDE_PROJECT_DIR ??
      process.cwd(),
  );
  const stage = parseFlag({ argv, flag: "--stage" }) ?? "ungrouped";
  const result = parseFlag({ argv, flag: "--result" }) ?? "unknown";
  const command = parseFlag({ argv, flag: "--command" }) ?? "";
  const passArg = parseFlag({ argv, flag: "--pass" });
  const violationsArg = parseFlag({ argv, flag: "--violations" });
  const decayPassArg = parseFlag({ argv, flag: "--decay-pass" });
  const decayViolationsArg = parseFlag({ argv, flag: "--decay-violations" });
  const timestamp =
    parseFlag({ argv, flag: "--ts" }) ?? new Date().toISOString();

  const verdict: GateVerdict = {
    pass: passArg !== "false",
    violationsCount: Number(violationsArg ?? "0"),
    decayPass: decayPassArg !== "false",
    decayViolationsCount: Number(decayViolationsArg ?? "0"),
  };

  const outcome = appendGateRun({
    projectDir,
    stage,
    result,
    command,
    verdict,
    timestamp,
  });
  process.stdout.write(
    `${JSON.stringify({ written: outcome.written, path: outcome.path, basis: gitBasis({ projectDir }) })}\n`,
  );
}

export type { GateRunRecord, GateVerdict };
export { appendGateRun, sanitizeUnit };
