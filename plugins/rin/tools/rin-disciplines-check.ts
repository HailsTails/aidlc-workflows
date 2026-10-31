import type { CommandOutput, SyncCommandInput } from "./rin-gates/review-process-port.ts";
import type { PathOperations } from "./rin-harness-path-operations.ts";
import type { FileKindPort } from "./rin-harness-sidecar-file-reader.ts";
import { DISCIPLINE_CORE_INSTALL } from "./rin-disciplines-report.ts";

type DisciplinesCheckOutcome =
  | { readonly kind: "passed" }
  | { readonly kind: "failed"; readonly report: string }
  | { readonly kind: "unverified"; readonly reason: string };

type DisciplinesCheckRequest = {
  readonly checkoutRoot: string;
  readonly baseRevision: string | undefined;
};

type DisciplinesCheckPorts = {
  readonly runSync: (input: SyncCommandInput) => CommandOutput;
  readonly pathOperations: PathOperations;
  readonly fileKind: FileKindPort;
  readonly timeoutMilliseconds: number;
};

const PASSING_EXIT_CODE = 0;

const FAILING_EXIT_CODE = 1;

const FAILING_VERDICT = /verdict: fail\s*$/;

const OUTPUT_SHOWN_LENGTH = 2000;

const checkCommandPathOf = ({
  checkoutRoot,
  pathOperations,
}: {
  readonly checkoutRoot: string;
  readonly pathOperations: PathOperations;
}): string =>
  pathOperations.join({
    segments: [checkoutRoot, ...DISCIPLINE_CORE_INSTALL.split("/"), "core", "check", "check-command.ts"],
  });

const checkArgumentsOf = ({
  checkCommandPath,
  request,
}: {
  readonly checkCommandPath: string;
  readonly request: DisciplinesCheckRequest;
}): readonly string[] => [
  checkCommandPath,
  "--repo",
  request.checkoutRoot,
  ...(request.baseRevision === undefined ? [] : ["--base-revision", request.baseRevision]),
];

const noVerdictOf = ({
  output,
  timeoutMilliseconds,
}: {
  readonly output: CommandOutput;
  readonly timeoutMilliseconds: number;
}): DisciplinesCheckOutcome => {
  const ending =
    output.status === null
      ? `no exit status: node did not start, or did not finish within ${String(timeoutMilliseconds)}ms`
      : `exit ${String(output.status)}`;
  const printed = `${output.stdout}${output.stderr}`.trim().slice(-OUTPUT_SHOWN_LENGTH);
  return { kind: "unverified", reason: printed === "" ? ending : `${ending}: ${printed}` };
};

const disciplinesCheckOutcomeOf = ({
  output,
  timeoutMilliseconds,
}: {
  readonly output: CommandOutput;
  readonly timeoutMilliseconds: number;
}): DisciplinesCheckOutcome => {
  if (output.status === PASSING_EXIT_CODE) {
    return { kind: "passed" };
  }
  if (output.status === FAILING_EXIT_CODE && FAILING_VERDICT.test(output.stdout)) {
    return { kind: "failed", report: output.stdout };
  }
  return noVerdictOf({ output, timeoutMilliseconds });
};

const runDisciplinesCheck = ({
  request,
  ports,
}: {
  readonly request: DisciplinesCheckRequest;
  readonly ports: DisciplinesCheckPorts;
}): DisciplinesCheckOutcome => {
  const checkCommandPath = checkCommandPathOf({
    checkoutRoot: request.checkoutRoot,
    pathOperations: ports.pathOperations,
  });
  if (!ports.fileKind.isFile(checkCommandPath)) {
    return {
      kind: "unverified",
      reason: `discipline-core is not installed: ${checkCommandPath} does not exist`,
    };
  }
  return disciplinesCheckOutcomeOf({
    output: ports.runSync({
      program: "node",
      args: checkArgumentsOf({ checkCommandPath, request }),
      cwd: request.checkoutRoot,
      timeoutMilliseconds: ports.timeoutMilliseconds,
    }),
    timeoutMilliseconds: ports.timeoutMilliseconds,
  });
};

export type { DisciplinesCheckOutcome, DisciplinesCheckPorts, DisciplinesCheckRequest };
export { disciplinesCheckOutcomeOf, runDisciplinesCheck };
