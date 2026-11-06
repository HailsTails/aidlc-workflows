import type { SourceRecord, OutputRecord } from "../scripts/sensor-evidence.ts";
export type EvidenceLedgerFixture = {
  readonly provenance: { readonly files: readonly SourceRecord[] };
  readonly comparison: readonly OutputRecord[];
};
const sourcePaths = [
  "core/sensors/aidlc-linter.md",
  "plugins/test-pro/sensors/aidlc-coverage-threshold.md",
  "plugins/test-pro/contributions/construction/build-and-test.md",
  "scripts/package.ts",
  "scripts/manifest-types.ts",
  "core/tools/aidlc-plugin-emit.ts",
  "core/tools/aidlc-plugin-build.ts",
  "bun.lock",
  "harness/claude/manifest.ts",
  "harness/codex/manifest.ts",
  "harness/copilot/manifest.ts",
  "harness/cursor/manifest.ts",
  "harness/kiro/manifest.ts",
  "harness/kiro-ide/manifest.ts",
  "harness/opencode/manifest.ts",
];
const digest = "0000000000000000000000000000000000000000000000000000000000000000";
const revision = "0000000000000000000000000000000000000000";
export const evidenceLedgersFixture = ({
  replacementPath = "core/tools/aidlc-plugin-build.ts",
  replacementBaseline = "upstream",
  outputPath = ".claude/sensors/aidlc-linter.md",
}: {
  readonly replacementPath?: string;
  readonly replacementBaseline?: string;
  readonly outputPath?: string;
} = {}): EvidenceLedgerFixture => ({
  provenance: {
    files: ["upstream", "fork"].flatMap((baseline) =>
      sourcePaths.map((path) => ({
        baseline:
          baseline === "upstream" && path === "core/tools/aidlc-plugin-build.ts"
            ? replacementBaseline
            : baseline,
        path:
          baseline === "upstream" && path === "core/tools/aidlc-plugin-build.ts"
            ? replacementPath
            : path,
        pin: revision,
        sha256: digest,
        gitBlob: revision,
      })),
    ),
  },
  comparison: ["upstream", "fork"].flatMap((baseline) =>
    ["claude", "codex", "copilot", "cursor", "kiro", "kiro-ide", "opencode"].flatMap((harness) =>
      ["core-copy", "core-native", "plugin-repository", "plugin-offline"].map((channel) => ({
        baseline,
        harness,
        case: channel,
        path: outputPath,
        sha256: digest,
        matchesReference: true,
        command: "command: aidlc",
      })),
    ),
  ),
});

export type SensorFixtureIdentityFixture = {
  readonly baseline: string;
  readonly harness: string;
  readonly channel: string;
  readonly kind: string;
};
export const sensorFixtureCoverageFixture = (
  replacement: Partial<SensorFixtureIdentityFixture> = {},
): readonly SensorFixtureIdentityFixture[] =>
  ["upstream", "fork"].flatMap((baseline) =>
    ["claude", "codex", "copilot", "cursor", "kiro", "kiro-ide", "opencode"].flatMap((harness) =>
      [
        { channel: "copy", kind: "core" },
        { channel: "copy", kind: "plugin" },
        { channel: "native", kind: "core" },
      ].map((slot) => ({
        baseline,
        harness,
        ...slot,
        ...(baseline === "upstream" &&
        harness === "claude" &&
        slot.channel === "copy" &&
        slot.kind === "plugin"
          ? replacement
          : {}),
      })),
    ),
  );
