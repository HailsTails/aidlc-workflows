import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { env } from "node:process";
import { fileURLToPath } from "node:url";
import { describe, expect, onTestFinished, test } from "vitest";
import { z } from "zod";
import {
  appendReviewSectionToFile,
  type BoardVerdictToken,
  recordEngineReceipt,
  spawnEngineReview,
} from "./rin-gates-engine-receipt";

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
const statePath = join(repoRoot, "core", "tools", "aidlc-state.ts");

const GATE = "probe-gate-bridged";
const REVIEWER = "aidlc-architecture-reviewer-agent";
const ARTIFACT = "probe-artifact.md";

// A faithful copy of the engine's on-disk wire schema — snake_case keys are the
// engine's, not ours to rename, so the node is assembled through an index
// signature rather than a camelCase-violating literal.
const stageNode = (): Record<string, unknown> => {
  const node: Record<string, unknown> = {
    slug: GATE,
    number: "2.92",
    name: GATE,
    phase: "inception",
    execution: "ALWAYS",
    mode: "inline",
    produces: ["probe-artifact"],
    consumes: [],
    scopes: ["probe-scope"],
    reviewer: REVIEWER,
    outputs: ARTIFACT,
  };
  // AIDLC 2.7.0 requires every reviewer-bearing stage to name which required
  // Markdown output owns the appended `## Review` section. The fixture's sole
  // produces entry is that target; without it the engine refuses to record a
  // receipt at all, and every case here fails for a reason unrelated to the
  // bridge it is measuring. Assigned through the index signature like its
  // siblings below — the snake_case key is the engine's wire schema, not ours.
  node["review_artifact"] = "probe-artifact";
  node["lead_agent"] = "aidlc-product-agent";
  node["reviewer_max_iterations"] = 2;
  node["review_class"] = "adversarial";
  node["approval_mode"] = "autonomous";
  return node;
};

type Fixture = {
  readonly projectDir: string;
  readonly intentDir: string;
  readonly env: NodeJS.ProcessEnv;
};

const buildFixture = (): Fixture => {
  const projectDir = mkdtempSync(join(tmpdir(), "rin-receipt-live-"));
  onTestFinished(() => rmSync(projectDir, { recursive: true, force: true }));
  cpSync(join(repoRoot, "dist", "opencode", ".aidlc"), join(projectDir, ".aidlc"), { recursive: true });
  const intentsRoot = join(projectDir, "aidlc", "spaces", "default", "intents");
  const intentDir = join(intentsRoot, "probe-intent");
  mkdirSync(join(intentDir, "audit"), { recursive: true });
  writeFileSync(
    join(intentDir, "aidlc-state.md"),
    [
      "# AI-DLC State Tracking",
      "",
      "## Project Information",
      "- **Scope**: probe-scope",
      `- **Current Stage**: ${GATE}`,
      "- **Revision Count**: 0",
      "",
      "## Stage Progress",
      `- [?] ${GATE} — EXECUTE`,
      "",
    ].join("\n"),
  );
  writeFileSync(join(intentsRoot, "active-intent"), "probe-intent");
  writeFileSync(
    join(intentsRoot, "intents.json"),
    JSON.stringify([
      {
        uuid: "0",
        slug: "probe-intent",
        dirName: "probe-intent",
        scope: "probe-scope",
        status: "in-flight",
      },
    ]),
  );

  const graphPath = join(projectDir, "stage-graph.json");
  writeFileSync(graphPath, JSON.stringify([stageNode()]));
  const mappingPath = join(projectDir, "scope-mapping.json");
  writeFileSync(
    mappingPath,
    JSON.stringify({ "probe-scope": { stages: { [GATE]: "EXECUTE" } } }),
  );

  const merged: NodeJS.ProcessEnv = { ...env };
  merged.AIDLC_SKIP_ARTIFACT_GUARD = "1";
  merged.AIDLC_ALLOW_DIRECT_STATE_TRANSITIONS = "1";
  merged["AIDLC_STAGE_GRAPH"] = graphPath;
  merged["AIDLC_SCOPE_MAPPING"] = mappingPath;

  // The gate's produces[] artefact, written BEFORE the board convenes — the real
  // ordering, and the one the engine's invalidation floor cares about. It lives
  // at the phase/stage-scoped path the engine resolves a produces entry to, not
  // flat in the record dir; a required output it cannot read refuses the review
  // before the bridge under test is ever reached.
  const artifactDir = join(intentDir, "inception", GATE);
  mkdirSync(artifactDir, { recursive: true });
  writeFileSync(
    join(artifactDir, ARTIFACT),
    "# probe artifact\n\nframed scope\n",
  );

  return { projectDir, intentDir, env: merged };
};

const approve = (
  fixture: Fixture,
): { readonly status: number | null; readonly output: string } => {
  const run = spawnSync(
    "bun",
    [statePath, "approve", GATE, "--project-dir", fixture.projectDir],
    { cwd: repoRoot, encoding: "utf-8", env: fixture.env },
  );
  return {
    status: run.status,
    output: `${run.stdout ?? ""}${run.stderr ?? ""}`,
  };
};

const auditText = (fixture: Fixture): string =>
  readdirSync(join(fixture.intentDir, "audit"))
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) =>
      readFileSync(join(fixture.intentDir, "audit", file), "utf-8"),
    )
    .join("\n");


const requestSchema = z.object({
  emitted: z.literal("REVIEW_REQUESTED"),
  requestId: z.string().min(1),
  reviewFile: z.string().min(1),
  recordVerdict: z.string().min(1),
});
type Request = z.infer<typeof requestSchema>;

const requestReview = (input: { readonly fixture: Fixture; readonly iteration: number }): Request => {
  const result = spawnEngineReview({ enginePath: join(input.fixture.projectDir, ".aidlc", "tools", "aidlc-log.ts"), engineEnv: input.fixture.env })({
    projectDir: input.fixture.projectDir,
    stage: GATE,
    reviewer: REVIEWER,
    iteration: input.iteration,
    verdict: null,
  });
  expect(result.ok, result.output).toBe(true);
  return requestSchema.parse(JSON.parse(result.output));
};

const reportText = (input: {
  readonly verdict: BoardVerdictToken;
  readonly iteration: number;
  readonly priorRows?: readonly string[];
  readonly newRows?: readonly string[];
}): string => [
  "## Review", "", `**Verdict:** ${input.verdict}`,
  `**Reviewer:** ${REVIEWER}`, `**Iteration:** ${input.iteration}`,
  "", "### Findings", "", "**Prior findings**", "",
  "| ID | Now | Severity | Note |", "|---|---|---|---|",
  ...(input.priorRows ?? []),
  "", "**New findings**", "",
  "| Severity | Location | Finding | Required action |", "|---|---|---|---|",
  ...(input.newRows ?? []), "",
].join("\n");

const conductBoardReview = (input: {
  readonly fixture: Fixture;
  readonly verdict: BoardVerdictToken;
  readonly iteration?: number;
  readonly priorRows?: readonly string[];
  readonly newRows?: readonly string[];
}) => {
  const iteration = input.iteration ?? 1;
  const request = requestReview({ fixture: input.fixture, iteration });
  const handoff = recordEngineReceipt({
    projectDir: input.fixture.projectDir,
    gate: GATE,
    declaredReviewer: REVIEWER,
    aggregate: input.verdict,
    invokeEngine: spawnEngineReview({ enginePath: join(input.fixture.projectDir, ".aidlc", "tools", "aidlc-log.ts"), engineEnv: input.fixture.env }),
    appendReviewSection: appendReviewSectionToFile({
      resolveArtifactPath: () => join(input.fixture.intentDir, "inception", GATE, ARTIFACT),
    }),
  });
  const text = reportText({ verdict: input.verdict, iteration, priorRows: input.priorRows, newRows: input.newRows });
  writeFileSync(join(input.fixture.projectDir, request.reviewFile), text);
  return { request, handoff, text };
};

const recordConductorVerdict = (input: {
  readonly fixture: Fixture;
  readonly request: Request;
  readonly verdict: BoardVerdictToken;
  readonly extraArguments?: string;
}) => {
  const command = input.request.recordVerdict.replace("<READY|NOT-READY>", input.verdict) + (input.extraArguments ?? "");
  const shell = process.platform === "win32" ? "powershell" : "/bin/bash";
  const args = process.platform === "win32" ? ["-NoProfile", "-Command", command] : ["-c", command];
  const result = spawnSync(shell, args, { cwd: input.fixture.projectDir, encoding: "utf8", env: input.fixture.env });
  return { status: result.status, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
};

const completedSchema = z.object({ emitted: z.literal("REVIEW_COMPLETED"), reviewRecord: z.string() });
const recordSchema = z.object({
  request_id: z.string(),
  verdict: z.enum(["READY", "NOT-READY"]),
  findings: z.array(z.object({
    id: z.string(), severity: z.string(), location: z.string(), finding: z.string(),
    required_action: z.string(), status: z.string(),
  })),
  body: z.string(),
});
const readRecordedReview = (input: { readonly fixture: Fixture; readonly output: string }) => {
  const completed = completedSchema.parse(JSON.parse(input.output));
  return recordSchema.parse(JSON.parse(readFileSync(join(input.fixture.intentDir, completed.reviewRecord), "utf8")));
};
const artifactText = (fixture: Fixture): string => readFileSync(join(fixture.intentDir, "inception", GATE, ARTIFACT), "utf8");
const concernRows = [
  "| Major | aidlc/spaces/default/intents/probe-intent/inception/probe-gate-bridged/probe-artifact.md > framed scope | The scope omits the excluded case | Describe the excluded case |",
];

describe("the conductor report closes the engine-owned board review", () => {
  test("without a receipt the engine refuses approval", () => {
    const fixture = buildFixture();
    const result = approve(fixture);
    expect(result.status).not.toBe(0);
    expect(result.output).toContain("REVIEW_EVIDENCE_MISSING");
  });

  test("an empty READY report preserves artifact bytes and closes the exact pending request once", () => {
    const fixture = buildFixture();
    const review = conductBoardReview({ fixture, verdict: "READY" });
    expect(review.handoff).toEqual({ kind: "conductor-report", reviewer: REVIEWER, verdict: "READY" });
    expect(artifactText(fixture)).toBe("# probe artifact\n\nframed scope\n");
    expect(auditText(fixture)).not.toContain("**Event**: REVIEW_COMPLETED");
    const completed = recordConductorVerdict({ fixture, request: review.request, verdict: "READY" });
    expect(completed.status, completed.output).toBe(0);
    const record = readRecordedReview({ fixture, output: completed.output });
    expect(record.request_id).toBe(review.request.requestId);
    expect(record.findings).toEqual([]);
    expect(record.body).toBe(review.text);
    expect(artifactText(fixture)).toBe("# probe artifact\n\nframed scope\n");
    expect(approve(fixture).status).toBe(0);
    expect(auditText(fixture).match(/\*\*Event\*\*: REVIEW_REQUESTED/g)).toHaveLength(1);
    expect(auditText(fixture).match(/\*\*Event\*\*: REVIEW_COMPLETED/g)).toHaveLength(1);
  });

  test("nonempty NOT-READY findings survive in the genuine engine record", () => {
    const fixture = buildFixture();
    const review = conductBoardReview({ fixture, verdict: "NOT-READY", newRows: concernRows });
    const completed = recordConductorVerdict({ fixture, request: review.request, verdict: "NOT-READY" });
    expect(completed.status, completed.output).toBe(0);
    const record = readRecordedReview({ fixture, output: completed.output });
    expect(record.verdict).toBe("NOT-READY");
    expect(record.request_id).toBe(review.request.requestId);
    expect(record.findings).toEqual([{
      id: "R-01", severity: "Major",
      location: "aidlc/spaces/default/intents/probe-intent/inception/probe-gate-bridged/probe-artifact.md > framed scope",
      finding: "The scope omits the excluded case", required_action: "Describe the excluded case", status: "New",
    }]);
    expect(artifactText(fixture)).toBe("# probe artifact\n\nframed scope\n");
  });

  test("a prior finding keeps its engine ID and reported state on the next request", () => {
    const fixture = buildFixture();
    const first = conductBoardReview({ fixture, verdict: "NOT-READY", newRows: concernRows });
    const firstCompleted = recordConductorVerdict({ fixture, request: first.request, verdict: "NOT-READY" });
    expect(firstCompleted.status, firstCompleted.output).toBe(0);
    const second = conductBoardReview({
      fixture, verdict: "NOT-READY", iteration: 2,
      priorRows: ["| R-01 | Still applies | Major | The exclusion remains absent |"],
    });
    const secondCompleted = recordConductorVerdict({ fixture, request: second.request, verdict: "NOT-READY" });
    expect(secondCompleted.status, secondCompleted.output).toBe(0);
    const record = readRecordedReview({ fixture, output: secondCompleted.output });
    expect(record.findings).toEqual([{
      id: "R-01", severity: "Major",
      location: "aidlc/spaces/default/intents/probe-intent/inception/probe-gate-bridged/probe-artifact.md > framed scope",
      finding: "The scope omits the excluded case", required_action: "Describe the excluded case", status: "Unresolved",
    }]);
    expect(record.request_id).toBe(second.request.requestId);
  });

  test("a different report path cannot close the request", () => {
    const fixture = buildFixture();
    const review = conductBoardReview({ fixture, verdict: "READY" });
    writeFileSync(join(fixture.intentDir, "unowned-review.md"), review.text);
    const refused = recordConductorVerdict({ fixture, request: review.request, verdict: "READY", extraArguments: " --review-file aidlc/spaces/default/intents/probe-intent/unowned-review.md" });
    expect(refused.status).not.toBe(0);
    expect(refused.output).toContain("is not the review");
    expect(auditText(fixture)).not.toContain("**Event**: REVIEW_COMPLETED");
    const accepted = recordConductorVerdict({ fixture, request: review.request, verdict: "READY" });
    expect(accepted.status, accepted.output).toBe(0);
  });

  test("an artifact write after dispatch refuses the same genuine report", () => {
    const fixture = buildFixture();
    const review = conductBoardReview({ fixture, verdict: "READY" });
    writeFileSync(join(fixture.intentDir, "inception", GATE, ARTIFACT), "# changed artifact\n");
    const completed = recordConductorVerdict({ fixture, request: review.request, verdict: "READY" });
    expect(completed.status).not.toBe(0);
    expect(completed.output).toContain("changed");
    expect(auditText(fixture)).not.toContain("**Event**: REVIEW_COMPLETED");
  });

  test("a legacy appendix plus a modern report is refused", () => {
    const fixture = buildFixture();
    const review = conductBoardReview({ fixture, verdict: "READY" });
    const append = appendReviewSectionToFile({ resolveArtifactPath: () => join(fixture.intentDir, "inception", GATE, ARTIFACT) });
    append({ projectDir: fixture.projectDir, stage: GATE, section: review.text });
    const completed = recordConductorVerdict({ fixture, request: review.request, verdict: "READY" });
    expect(completed.status).not.toBe(0);
    expect(completed.output).toContain("a review file was also written");
    expect(auditText(fixture)).not.toContain("**Event**: REVIEW_COMPLETED");
  });
});
