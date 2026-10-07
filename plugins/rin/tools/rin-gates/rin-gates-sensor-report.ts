type SensorDocument =
  | { readonly kind: "present"; readonly text: string }
  | { readonly kind: "absent" };

type TextRead =
  | SensorDocument
  | { readonly kind: "unreadable"; readonly reason: string };

type SensorFileReader = {
  readonly readText: (request: { readonly path: string }) => TextRead;
};

type FindingLocation =
  | { readonly kind: "line"; readonly lineNumber: number }
  | { readonly kind: "artefact" };

type SensorFinding = {
  readonly check: string;
  readonly artefact: string;
  readonly location: FindingLocation;
  readonly subject: string;
  readonly remedy: string;
};

type SensorVerdict = "clean" | "refused" | "unmeasured";

type SensorReport = {
  readonly sensor: string;
  readonly verdict: SensorVerdict;
  readonly findings: readonly SensorFinding[];
  readonly scanned: string;
};

const FINDINGS_COUNT_KEY = "findings_count";

const lineLocation = ({
  lineNumber,
}: {
  readonly lineNumber: number;
}): FindingLocation => ({
  kind: "line",
  lineNumber,
});

const WHOLE_ARTEFACT_LOCATION: FindingLocation = { kind: "artefact" };

const judgedReport = ({
  sensor,
  findings,
  scanned,
}: {
  readonly sensor: string;
  readonly findings: readonly SensorFinding[];
  readonly scanned: string;
}): SensorReport => ({
  sensor,
  verdict: findings.length === 0 ? "clean" : "refused",
  findings,
  scanned,
});

const unmeasuredReport = ({
  sensor,
  findings,
  scanned,
}: {
  readonly sensor: string;
  readonly findings: readonly SensorFinding[];
  readonly scanned: string;
}): SensorReport => ({ sensor, verdict: "unmeasured", findings, scanned });

type UnmeasuredCause =
  | "incomplete-invocation"
  | "wrong-gate"
  | "input-unavailable";

const UNMEASURED_REMEDIES: Readonly<Record<UnmeasuredCause, string>> = {
  "incomplete-invocation":
    "The sensor was invoked without the flags it needs, so it refuses rather than passes. Invoke it with --stage and --output-path, as the engine does for a sensor a stage lists.",
  "wrong-gate":
    "The sensor judges one gate only, so it refuses rather than passes elsewhere. Remove it from the invoking stage's sensors list, or run it at its own gate.",
  "input-unavailable":
    "The sensor could not read an input this gate needs, so it refuses rather than passes. Restore the named input and re-run the gate.",
};

const unmeasuredFinding = ({
  check,
  artefact,
  reason,
  cause,
}: {
  readonly check: string;
  readonly artefact: string;
  readonly reason: string;
  readonly cause: UnmeasuredCause;
}): SensorFinding => ({
  check,
  artefact,
  location: WHOLE_ARTEFACT_LOCATION,
  subject: `unmeasured: ${reason}`,
  remedy: UNMEASURED_REMEDIES[cause],
});

const renderSensorReport = ({
  report,
}: {
  readonly report: SensorReport;
}): string =>
  `${JSON.stringify({
    pass: report.verdict === "clean",
    sensor: report.sensor,
    verdict: report.verdict,
    [FINDINGS_COUNT_KEY]: report.findings.length,
    findings: report.findings,
    scanned: report.scanned,
  })}\n`;

export {
  type FindingLocation,
  judgedReport,
  lineLocation,
  renderSensorReport,
  type SensorDocument,
  type SensorFileReader,
  type SensorFinding,
  type SensorReport,
  type SensorVerdict,
  type TextRead,
  type UnmeasuredCause,
  unmeasuredFinding,
  unmeasuredReport,
  WHOLE_ARTEFACT_LOCATION,
};
