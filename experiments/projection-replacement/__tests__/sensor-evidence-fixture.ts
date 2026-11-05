import type {
  SensorEvidence,
  SourceEvidence,
  OutputEvidence,
  FixtureEvidence,
} from "../scripts/sensor-ledger.ts";
export const sensorEvidenceFixture = (
  changes: {
    readonly source?: Partial<SourceEvidence>;
    readonly output?: Partial<OutputEvidence>;
    readonly fixture?: Partial<FixtureEvidence>;
  } = {},
): SensorEvidence => ({
  sources: [
    {
      baseline: "fork",
      pin: "pinned",
      path: "core/sensors/aidlc-linter.md",
      sha256: "source-digest",
      gitBlob: "source-blob",
      observedSha256: "source-digest",
      observedGitBlob: "source-blob",
      ...changes.source,
    },
  ],
  outputs: [
    {
      baseline: "fork",
      harness: "claude",
      channel: "core-copy",
      path: ".claude/sensors/aidlc-linter.md",
      comparison: "matches",
      sha256: "output-digest",
      command: "command: aidlc",
      observedSha256: "output-digest",
      observedCommand: "command: aidlc",
      ...changes.output,
    },
  ],
  fixtures: [
    {
      baseline: "fork",
      harness: "claude",
      channel: "copy",
      kind: "core",
      inputSha256: "source-digest",
      expectedSha256: "output-digest",
      resourceSha256: "output-digest",
      path: ".claude/sensors/aidlc-linter.md",
      ...changes.fixture,
    },
  ],
});
