import type { ProjectionWrite } from "../mechanism-port/runner-result-schema.ts";
import type { ExitCode } from "../platform-ports/process-port.ts";
import type { ReportOutput } from "../values/report-output.ts";
import type { Result } from "../values/result.ts";
import type { CheckReport } from "../verdict/check-report.ts";
import { renderReportText } from "../verdict/report-text.ts";
import { verdictOf } from "../verdict/verdict.ts";
import type { LoadFailure } from "./load-failure.ts";
import { loadFailureText } from "./load-failure-text.ts";

export type CommandOutcome = {
  readonly code: ExitCode;
  readonly text: string;
};

export type CheckRun = {
  readonly report: CheckReport;
  readonly output: ReportOutput;
};

const LOAD_FAILURE_CODE = 2;

const loadFailureOutcome = (request: { readonly failure: LoadFailure }): CommandOutcome => ({
  code: LOAD_FAILURE_CODE,
  text: loadFailureText(request),
});

const checkRunOutcome = (request: { readonly run: CheckRun }): CommandOutcome => ({
  code: verdictOf({ report: request.run.report }) === "pass" ? 0 : 1,
  text: renderReportText(request.run),
});

export const checkCommandOutcome = (request: {
  readonly result: Result<CheckRun, LoadFailure>;
}): CommandOutcome =>
  request.result.outcome === "failed"
    ? loadFailureOutcome({ failure: request.result.error })
    : checkRunOutcome({ run: request.result.value });

export const projectCommandOutcome = (request: {
  readonly result: Result<readonly ProjectionWrite[], LoadFailure>;
}): CommandOutcome => {
  if (request.result.outcome === "failed") {
    return loadFailureOutcome({ failure: request.result.error });
  }
  return {
    code: 0,
    text: request.result.value.map((write) => `${write.path} ${write.effect}\n`).join(""),
  };
};
