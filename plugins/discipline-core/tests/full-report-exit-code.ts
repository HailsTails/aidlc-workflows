import { checkCommandOutcome } from "../core/check/command-outcome.ts";
import type { LoadFailure } from "../core/check/load-failure.ts";
import type { ExitCode } from "../core/platform-ports/process-port.ts";
import type { Result } from "../core/values/result.ts";
import type { CheckReport } from "../core/verdict/check-report.ts";

export const fullReportExitCode = (request: { readonly checked: Result<CheckReport, LoadFailure> }): ExitCode =>
  checkCommandOutcome({
    result:
      request.checked.outcome === "failed"
        ? request.checked
        : { outcome: "ok", value: { report: request.checked.value, output: "full" } },
  }).code;
