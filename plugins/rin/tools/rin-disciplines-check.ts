import type { CommandOutput, SyncCommandInput } from "./rin-gates/review-process-port.ts";
import type { PathOperations } from "./rin-harness-path-operations.ts";
import type { FileKindPort } from "./rin-harness-sidecar-file-reader.ts";
import { DISCIPLINE_CORE_PACKAGE, PACKAGED_CORE_INSTALL, VENDORED_CORE_INSTALL } from "./rin-disciplines-report.ts";

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

const PASSING_VERDICT = /verdict: pass\s*$/;

const FAILING_VERDICT = /verdict: fail\s*$/;

const OUTPUT_SHOWN_LENGTH = 2000;

type CoreInstallForm = "packaged" | "vendored";

type CoreInstall = {
  readonly form: CoreInstallForm;
  readonly root: string;
  readonly checkCommandPath: string;
};

const CORE_INSTALL_PLACES: readonly { readonly form: CoreInstallForm; readonly location: string; readonly checkCommand: string }[] = [
  { form: "packaged", location: PACKAGED_CORE_INSTALL, checkCommand: "check-command.js" },
  { form: "vendored", location: VENDORED_CORE_INSTALL, checkCommand: "check-command.ts" },
];

const coreInstallsOf = ({
  checkoutRoot,
  pathOperations,
}: {
  readonly checkoutRoot: string;
  readonly pathOperations: PathOperations;
}): readonly CoreInstall[] =>
  CORE_INSTALL_PLACES.map((place) => {
    const root = pathOperations.join({ segments: [checkoutRoot, ...place.location.split("/")] });
    return {
      form: place.form,
      root,
      checkCommandPath: pathOperations.join({ segments: [root, "core", "check", place.checkCommand] }),
    };
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
  if (output.status === PASSING_EXIT_CODE && PASSING_VERDICT.test(output.stdout)) {
    return { kind: "passed" };
  }
  if (output.status === FAILING_EXIT_CODE && FAILING_VERDICT.test(output.stdout)) {
    return { kind: "failed", report: output.stdout };
  }
  return noVerdictOf({ output, timeoutMilliseconds });
};

const unverifiedVendoredPassOf = ({ install }: { readonly install: CoreInstall }): DisciplinesCheckOutcome => ({
  kind: "unverified",
  reason: `the vendored copy at ${install.root} passed, but a vendored copy is not a verified install: move it to the ${DISCIPLINE_CORE_PACKAGE} package as ${VENDORED_CORE_INSTALL}/MIGRATING.md says`,
});

const runDisciplinesCheck = ({
  request,
  ports,
}: {
  readonly request: DisciplinesCheckRequest;
  readonly ports: DisciplinesCheckPorts;
}): DisciplinesCheckOutcome => {
  const installs = coreInstallsOf({ checkoutRoot: request.checkoutRoot, pathOperations: ports.pathOperations });
  const install = installs.find((candidate) => ports.fileKind.isFile(candidate.checkCommandPath));
  if (install === undefined) {
    return {
      kind: "unverified",
      reason: `discipline-core is not installed: neither ${installs.map((candidate) => candidate.checkCommandPath).join(" nor ")} exists`,
    };
  }
  const outcome = disciplinesCheckOutcomeOf({
    output: ports.runSync({
      program: "node",
      args: checkArgumentsOf({ checkCommandPath: install.checkCommandPath, request }),
      cwd: request.checkoutRoot,
      timeoutMilliseconds: ports.timeoutMilliseconds,
    }),
    timeoutMilliseconds: ports.timeoutMilliseconds,
  });
  return install.form === "vendored" && outcome.kind === "passed" ? unverifiedVendoredPassOf({ install }) : outcome;
};

export type { DisciplinesCheckOutcome, DisciplinesCheckPorts, DisciplinesCheckRequest };
export { disciplinesCheckOutcomeOf, runDisciplinesCheck };
