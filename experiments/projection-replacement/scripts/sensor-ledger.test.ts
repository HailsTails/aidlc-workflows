import { expect, test } from "bun:test";
import { sensorEvidenceFixture } from "../__tests__/sensor-evidence-fixture.ts";
import { sensorFixtureCoverageFixture } from "../__tests__/evidence-ledgers.ts";
import {
  verifySensorEvidence,
  verifySensorFixtureCoverage,
  verifySensorFixtureShape,
} from "./sensor-ledger.ts";
test("consistent evidence has no findings", () => {
  expect(verifySensorEvidence(sensorEvidenceFixture())).toEqual([]);
});
test("source SHA and Git blob detect altered bytes", () => {
  expect(
    verifySensorEvidence(
      sensorEvidenceFixture({ source: { observedSha256: "altered", observedGitBlob: "altered" } }),
    ),
  ).toEqual([
    "source bytes: fork/core/sensors/aidlc-linter.md",
    "source blob: fork/core/sensors/aidlc-linter.md",
  ]);
});
test("retained output bytes and command are checked", () => {
  expect(
    verifySensorEvidence(
      sensorEvidenceFixture({
        output: { observedSha256: "altered", observedCommand: "command: altered" },
      }),
    ),
  ).toEqual(["output bytes: fork/core-copy/claude", "output command: fork/core-copy/claude"]);
});
test("fixture source bytes remain bound to provenance", () => {
  expect(
    verifySensorEvidence(sensorEvidenceFixture({ fixture: { inputSha256: "altered" } })),
  ).toEqual(["fixture source: fork/copy/claude/core"]);
});
test("fixture expectation cannot drift with its resource", () => {
  expect(
    verifySensorEvidence(
      sensorEvidenceFixture({ fixture: { expectedSha256: "altered", resourceSha256: "altered" } }),
    ),
  ).toEqual([
    "fixture expectation: fork/copy/claude/core",
    "comparison claim: fork/core-copy/claude",
  ]);
});
test("resource bytes and placement are independently bound", () => {
  expect(
    verifySensorEvidence(
      sensorEvidenceFixture({ fixture: { resourceSha256: "altered", path: "elsewhere.md" } }),
    ),
  ).toEqual([
    "fixture resource: fork/copy/claude/core",
    "fixture placement: fork/copy/claude/core",
  ]);
});
test("ledger match claim cannot contradict expected bytes", () => {
  expect(
    verifySensorEvidence(sensorEvidenceFixture({ output: { comparison: "differs" } })),
  ).toEqual(["comparison claim: fork/core-copy/claude"]);
});
test("duplicate evidence identities refuse ambiguous lookups", () => {
  const evidence = sensorEvidenceFixture();
  expect(
    verifySensorEvidence({
      sources: [...evidence.sources, ...evidence.sources],
      outputs: [...evidence.outputs, ...evidence.outputs],
      fixtures: [...evidence.fixtures, ...evidence.fixtures],
    }),
  ).toEqual(["duplicate sources", "duplicate outputs", "duplicate fixtures"]);
});
test("missing source and retained output cannot silently skip a fixture", () => {
  expect(verifySensorEvidence({ ...sensorEvidenceFixture(), sources: [], outputs: [] })).toEqual([
    "fixture source: fork/copy/claude/core",
    "fixture expectation: fork/copy/claude/core",
    "fixture placement: fork/copy/claude/core",
  ]);
});

test("fixture coverage accepts every required baseline harness and channel-kind slot", () => {
  expect(verifySensorFixtureCoverage({ fixtures: sensorFixtureCoverageFixture() })).toEqual([]);
});
test.each([
  { channel: "native" },
  { kind: "core" },
  { harness: "codex" },
  { baseline: "fork" },
  { channel: "unexpected" },
  { harness: "unexpected" },
  { baseline: "unexpected" },
])("count-preserving fixture identity changes cannot remove a required slot: %s", (replacement) => {
  expect(
    verifySensorFixtureCoverage({ fixtures: sensorFixtureCoverageFixture(replacement) }),
  ).toEqual(["expected complete sensor fixture coverage"]);
});
test("fixture coverage rejects missing and extra fixtures", () => {
  const fixtures = sensorFixtureCoverageFixture();
  expect(verifySensorFixtureCoverage({ fixtures: [] })).toEqual([
    "expected complete sensor fixture coverage",
  ]);
  expect(verifySensorFixtureCoverage({ fixtures: [...fixtures, ...fixtures] })).toEqual([
    "expected complete sensor fixture coverage",
  ]);
});

test("fixture shape accepts one document and one resource", () => {
  expect(
    verifySensorFixtureShape({
      fixtures: [{ input: { documents: ["source"] }, resources: ["expected"] }],
    }),
  ).toEqual([]);
});
test.each([
  { input: { documents: [] }, resources: ["expected"] },
  { input: { documents: ["source", "extra"] }, resources: ["expected"] },
  { input: { documents: ["source"] }, resources: [] },
  { input: { documents: ["source"] }, resources: ["expected", "extra"] },
])("fixture shape refuses missing or extra documents and resources: %s", (fixture) => {
  expect(verifySensorFixtureShape({ fixtures: [fixture] })).toEqual([
    "expected one document and resource per fixture",
  ]);
});
