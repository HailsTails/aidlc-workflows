import { z } from "zod";
import { verifySensorFixtureCoverage, verifySensorFixtureShape } from "./sensor-ledger.ts";
import { sensorRenderingCases } from "../__tests__/sensor-cases.ts";
import type {
  SensorEvidence,
  SourceEvidence,
  OutputEvidence,
  FixtureEvidence,
} from "./sensor-ledger.ts";
const baseline = z.enum(["upstream", "fork"]);
const harness = z.enum(["claude", "codex", "copilot", "cursor", "kiro", "kiro-ide", "opencode"]);
const relativePath = z
  .string()
  .regex(/^(?!.*(?:^|\/)\.{1,2}(?:\/|$))[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)*$/);
const sourcePath = z.enum([
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
]);
const requiredSourceCount = baseline.options.length * sourcePath.options.length;
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const provenanceSchema = z.object({
  files: z
    .array(
      z.strictObject({
        baseline,
        pin: z.string().regex(/^[a-f0-9]{40}$/),
        path: sourcePath,
        sha256,
        gitBlob: z.string().regex(/^[a-f0-9]{40}$/),
      }),
    )
    .length(requiredSourceCount)
    .refine(
      (sources) =>
        new Set(sources.map((source) => `${source.baseline}/${source.path}`)).size ===
        requiredSourceCount,
    ),
});
const comparisonSchema = z
  .array(
    z.strictObject({
      baseline,
      harness,
      case: z.enum(["core-copy", "core-native", "plugin-repository", "plugin-offline"]),
      path: relativePath,
      matchesReference: z.boolean(),
      sha256,
      command: z.string(),
    }),
  )
  .length(56);
export type SourceRecord = Pick<SourceEvidence, "baseline" | "pin" | "path" | "sha256" | "gitBlob">;
export type OutputRecord = Pick<
  OutputEvidence,
  "baseline" | "harness" | "path" | "sha256" | "command"
> & {
  readonly case: string;
  readonly matchesReference: true | false;
};
export type EvidenceRefusal = {
  readonly status: "invalid";
  readonly code: "invalid-ledger" | "incomplete-fixtures" | "unreadable-evidence";
  readonly findings: readonly string[];
};
export type ParsedEvidenceLedgers =
  | {
      readonly status: "ok";
      readonly sources: readonly SourceRecord[];
      readonly outputs: readonly OutputRecord[];
    }
  | EvidenceRefusal;
export type EvidenceLoad =
  | { readonly status: "ok"; readonly evidence: SensorEvidence }
  | EvidenceRefusal;
export type EvidenceRepository = {
  readonly load: () => Promise<EvidenceLoad>;
};
export type EvidenceReporter = {
  readonly finish: (input: { readonly findings: readonly string[] }) => void;
};
const digest = ({ bytes }: { readonly bytes: Uint8Array | string }): string =>
  new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
const sourceSnapshot = async (source: SourceRecord): Promise<SourceEvidence> => {
  const path =
    source.path.endsWith("/sensors/aidlc-linter.md") ||
    source.path.endsWith("/sensors/aidlc-coverage-threshold.md")
      ? `__tests__/sensor-sources/${source.baseline}/${source.path}`
      : `verification/sensor-sources/${source.baseline}/${source.path}.txt`;
  const bytes = await Bun.file(new URL(`../${path}`, import.meta.url)).bytes();
  return {
    ...source,
    observedSha256: digest({ bytes }),
    observedGitBlob: new Bun.CryptoHasher("sha1")
      .update(`blob ${bytes.length}\0`)
      .update(bytes)
      .digest("hex"),
  };
};
const outputSnapshot = async (output: OutputRecord): Promise<OutputEvidence> => {
  const bytes = await Bun.file(
    new URL(
      `../verification/sensor-outputs/${output.baseline}/${output.case}/${output.harness}/${output.path}`,
      import.meta.url,
    ),
  ).bytes();
  return {
    ...output,
    channel: output.case,
    comparison: output.matchesReference ? "matches" : "differs",
    observedSha256: digest({ bytes }),
    observedCommand: new TextDecoder().decode(bytes).match(/^command:.*$/m)?.[0] ?? "",
  };
};
const fixtureSnapshot = (fixture: (typeof sensorRenderingCases)[number]): FixtureEvidence => {
  const document = fixture.input.documents[0];
  const resource = fixture.resources[0];
  return {
    baseline: fixture.baseline,
    harness: fixture.harness,
    channel: fixture.channel,
    kind: fixture.kind,
    inputSha256: digest({ bytes: document?.body ?? "" }),
    expectedSha256: digest({ bytes: fixture.expected.body }),
    resourceSha256: digest({ bytes: resource?.body ?? "" }),
    path: resource?.path ?? "",
  };
};
export const parseEvidenceLedgers = ({
  provenance,
  comparison,
}: {
  readonly provenance: unknown;
  readonly comparison: unknown;
}): ParsedEvidenceLedgers => {
  const sources = provenanceSchema.safeParse(provenance);
  const outputs = comparisonSchema.safeParse(comparison);
  if (!sources.success || !outputs.success)
    return {
      status: "invalid",
      code: "invalid-ledger",
      findings: ["invalid sensor provenance or comparison ledger"],
    };
  return { status: "ok", sources: sources.data.files, outputs: outputs.data };
};
const loadEvidence = async (): Promise<EvidenceLoad> => {
  try {
    const provenance: unknown = await Bun.file(
      new URL("../verification/sensor-provenance.json", import.meta.url),
    ).json();
    const comparison: unknown = await Bun.file(
      new URL("../verification/sensor-comparison.json", import.meta.url),
    ).json();
    const parsed = parseEvidenceLedgers({ provenance, comparison });
    if (parsed.status === "invalid") return parsed;
    const fixtureCoverage = verifySensorFixtureCoverage({ fixtures: sensorRenderingCases });
    if (fixtureCoverage.length > 0)
      return { status: "invalid", code: "incomplete-fixtures", findings: fixtureCoverage };
    const fixtureShape = verifySensorFixtureShape({ fixtures: sensorRenderingCases });
    if (fixtureShape.length > 0)
      return {
        status: "invalid",
        code: "incomplete-fixtures",
        findings: fixtureShape,
      };
    return {
      status: "ok",
      evidence: {
        sources: await Promise.all(parsed.sources.map(sourceSnapshot)),
        outputs: await Promise.all(parsed.outputs.map(outputSnapshot)),
        fixtures: sensorRenderingCases.map(fixtureSnapshot),
      },
    };
  } catch (failure: unknown) {
    return {
      status: "invalid",
      code: "unreadable-evidence",
      findings: [`sensor evidence could not be read: ${String(failure)}`],
    };
  }
};
export const createEvidenceRepository = (): EvidenceRepository => ({
  load: loadEvidence,
});
export const createEvidenceReporter = (): EvidenceReporter => ({
  finish: ({ findings }) => {
    console.log(
      findings.length === 0
        ? "sensor evidence: pass (30 sources, 56 outputs, 42 fixtures)"
        : findings.join("\n"),
    );
    process.exitCode = findings.length === 0 ? 0 : 1;
  },
});
