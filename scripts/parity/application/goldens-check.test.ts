import { expect, test } from "bun:test";
import { goldensCheck } from "./goldens-check.ts";
import type { GoldensDependencies } from "./goldens-check.ts";

const unavailable = {
  findings: [{
    subject: "baseline goldens",
    violation: "no baseline files are recorded",
    fix: "Supply non-empty goldens recorded from the independent pinned baseline before checking candidate output.",
  }],
  note: "baseline unavailable",
};

test("absent baseline cannot establish parity with absent output", () => {
  const dependencies: GoldensDependencies = {
    store: { read: () => ({}), write: () => { throw new Error("check must not write"); } },
    source: { measure: () => ({}) },
  };
  expect(goldensCheck(dependencies)).toEqual(unavailable);
});

test("named but empty baseline groups cannot establish parity", () => {
  const dependencies: GoldensDependencies = {
    store: { read: () => ({ claude: {} }), write: () => { throw new Error("check must not write"); } },
    source: { measure: () => ({ claude: {} }) },
  };
  expect(goldensCheck(dependencies)).toEqual(unavailable);
});

test("a recorded non-empty baseline and equal candidate retain their report", () => {
  const dependencies: GoldensDependencies = {
    store: { read: () => ({ claude: { "dist/claude/a": "pinned" } }), write: () => { throw new Error("check must not write"); } },
    source: { measure: () => ({ claude: { "dist/claude/a": "pinned" } }) },
  };
  expect(goldensCheck(dependencies)).toEqual({ findings: [], note: "files per harness: claude 1" });
});
