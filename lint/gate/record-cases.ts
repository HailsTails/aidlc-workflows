import { readFileSync, writeFileSync } from "node:fs";
import {
  CASE_WEIGHTS_PATH,
  caseWeightsDocument,
  withRecordedCases,
  type CaseWeights,
} from "./adapters/case-weights-file.ts";
import { casesFromJunit } from "./domain/case-split.ts";

const PAIR_SEPARATOR = "=";

const existingWeights = (): CaseWeights => {
  try {
    const parsed: { files?: CaseWeights } = JSON.parse(readFileSync(CASE_WEIGHTS_PATH, "utf8"));
    return parsed.files ?? {};
  } catch {
    return {};
  }
};

const pairs = process.argv.slice(2).map((argument) => argument.split(PAIR_SEPARATOR));

const recorded = pairs.reduce<CaseWeights>(
  (weights, [file, report]) =>
    withRecordedCases({
      existing: weights,
      file: file ?? "",
      cases: casesFromJunit(readFileSync(report ?? "", "utf8")),
    }),
  existingWeights(),
);

writeFileSync(CASE_WEIGHTS_PATH, caseWeightsDocument(recorded));
