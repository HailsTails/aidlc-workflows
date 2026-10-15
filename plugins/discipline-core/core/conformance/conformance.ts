import { z } from "zod";
import {
  type RunnerFailure,
  rejectedCall,
  runnerInvalidOutput,
} from "../mechanism-port/runner-failure.ts";
import type { LoadedRunner, RunnerClause } from "../mechanism-port/runner-module-schema.ts";
import {
  type CaseVerdict,
  caseVerdictSchema,
  runnerResultSchema,
} from "../mechanism-port/runner-result-schema.ts";
import type { SourceCase } from "../rule-set-reader/rule-set-reader.ts";
import type { ClauseAddress } from "../values/clause-address.ts";
import type { Result } from "../values/result.ts";

export type ConformanceFailure = {
  readonly clause: ClauseAddress;
  readonly caseName: string;
  readonly expectedLines: readonly number[];
  readonly flaggedLines: readonly number[];
};

const caseVerdictsResultSchema = runnerResultSchema({
  value: z.array(caseVerdictSchema).readonly(),
});

const lineSet = (request: { readonly lines: readonly number[] }): readonly number[] =>
  [...new Set(request.lines)].toSorted((left, right) => left - right);

const verdictsNaming = (request: {
  readonly verdicts: readonly CaseVerdict[];
  readonly caseName: string;
}): readonly CaseVerdict[] =>
  request.verdicts.filter((verdict) => verdict.caseName === request.caseName);

const unmatchedVerdict = (request: {
  readonly verdicts: readonly CaseVerdict[];
  readonly cases: readonly SourceCase[];
}): string | undefined => {
  const missing = request.cases.find(
    (sourceCase) => verdictsNaming({ verdicts: request.verdicts, caseName: sourceCase.name }).length !== 1,
  );
  if (missing !== undefined) {
    return `case ${missing.name} has no single verdict`;
  }
  const unknown = request.verdicts.find(
    (verdict) => !request.cases.some((sourceCase) => sourceCase.name === verdict.caseName),
  );
  return unknown === undefined ? undefined : `a verdict names the unknown case ${unknown.caseName}`;
};

const caseConformance = (request: {
  readonly sourceCase: SourceCase;
  readonly verdicts: readonly CaseVerdict[];
  readonly clause: RunnerClause;
}): readonly ConformanceFailure[] => {
  const { sourceCase } = request;
  const expectedLines = lineSet({ lines: sourceCase.expectedLines });
  const flaggedLines = lineSet({
    lines: verdictsNaming({ verdicts: request.verdicts, caseName: sourceCase.name }).flatMap(
      (verdict) => verdict.flaggedLines,
    ),
  });
  if (expectedLines.join(" ") === flaggedLines.join(" ")) {
    return [];
  }
  return [{ clause: request.clause.address, caseName: sourceCase.name, expectedLines, flaggedLines }];
};

const conformanceOf = (request: {
  readonly returned: unknown;
  readonly clause: RunnerClause;
  readonly cases: readonly SourceCase[];
}): Result<readonly ConformanceFailure[], RunnerFailure> => {
  const parsed = caseVerdictsResultSchema.safeParse(request.returned);
  if (!parsed.success) {
    return runnerInvalidOutput({ detail: z.prettifyError(parsed.error) });
  }
  if (parsed.data.outcome === "failed") {
    return parsed.data;
  }
  const verdicts = parsed.data.value;
  const unmatched = unmatchedVerdict({ verdicts, cases: request.cases });
  if (unmatched !== undefined) {
    return runnerInvalidOutput({ detail: unmatched });
  }
  return {
    outcome: "ok",
    value: request.cases.flatMap((sourceCase) => caseConformance({ sourceCase, verdicts, clause: request.clause })),
  };
};

export const checkConformance = (request: {
  readonly clause: RunnerClause;
  readonly cases: readonly SourceCase[];
  readonly runner: LoadedRunner;
}): Promise<Result<readonly ConformanceFailure[], RunnerFailure>> =>
  Promise.resolve()
    .then(() => request.runner.conform({ clause: request.clause, cases: request.cases }))
    .then(
      (returned) => conformanceOf({ returned, clause: request.clause, cases: request.cases }),
      (thrown: unknown) => rejectedCall({ thrown }),
    );
