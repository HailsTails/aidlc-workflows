// The LIVE-PATH proof for FR-6 (member 01a02cd6).
//
// The unit tests beside this file prove the bridge issues the right engine calls.
// They cannot prove the thing that actually matters: that a receipt recorded by
// the bridge, at the moment a board converges, SATISFIES the engine's reviewer
// precondition in a realistic gate sequence. That precondition floors on the
// latest STAGE_STARTED, resets on GATE_REJECTED, and is invalidated by any later
// produces[] write — so a bridge that records a technically well-formed receipt
// at the wrong moment leaves the gate exactly as refused as before, while every
// unit test still passes.
//
// So this test runs the REAL engine against a hermetic temp project (CD-47: its
// own workspace, its own audit shards, never the real checkout) and drives the
// real sequence: stage started → artefacts written → board convenes and converges
// → bridge records the receipt → `approve`. The assertion is the approve's own
// exit status, and the control is the same sequence with the bridge's receipt
// withheld, which must still refuse.

import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { env } from "node:process";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
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
const logPath = join(repoRoot, "core", "tools", "aidlc-log.ts");

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

// The bridge, invoked exactly as the scribe invokes it at convergence: the real
// engine writer, the gate's declared reviewer, the aggregate as the verdict.
const convergeBoardAndBridge = (
  fixture: Fixture,
  aggregate: BoardVerdictToken,
) =>
  recordEngineReceipt({
    projectDir: fixture.projectDir,
    gate: GATE,
    declaredReviewer: REVIEWER,
    aggregate,
    invokeEngine: spawnEngineReview({
      enginePath: logPath,
      engineEnv: fixture.env,
    }),
    // The REAL append seam, not a fake: the engine re-checks the appended bytes
    // at REVIEW_COMPLETED, so a faked append here would prove nothing about
    // whether the section this bridge writes actually satisfies the contract.
    appendReviewSection: appendReviewSectionToFile({
      resolveArtifactPath: () =>
        join(fixture.intentDir, "inception", GATE, ARTIFACT),
    }),
  });

describe("the bridged receipt satisfies the engine's reviewer precondition", () => {
  // The CONTROL. Without the bridge nothing records a receipt, and the engine
  // refuses — which is what makes the must-pass case below evidence rather than
  // a tautology about a gate that would have opened anyway.
  test("without a receipt the engine refuses to approve the gate", () => {
    const fixture = buildFixture();
    const result = approve(fixture);

    expect(result.status).not.toBe(0);
    // Anchored on the engine's machine-readable refusal code, not on the prose
    // around it. 2.9.0 rewrote that prose wholesale ("declares a reviewer ... no
    // fresh REVIEW_COMPLETED" became "has not reviewed the current output") while
    // the refusal itself was unchanged, so a sentence-level assertion broke on a
    // bump that altered nothing this test exists to guard.
    expect(result.output).toContain("REVIEW_EVIDENCE_MISSING");
  });

  test("a receipt recorded by the bridge at convergence lets the approve through", () => {
    const fixture = buildFixture();

    const receipt = convergeBoardAndBridge(fixture, "READY");
    expect(receipt).toEqual({
      kind: "recorded",
      reviewer: REVIEWER,
      iteration: 1,
    });

    const result = approve(fixture);
    expect(result.output).not.toContain("declares a reviewer");
    expect(result.status).toBe(0);
  });

  test("the receipt the bridge wrote is the engine's own REVIEW_COMPLETED row", () => {
    const fixture = buildFixture();
    convergeBoardAndBridge(fixture, "READY");

    const audit = auditText(fixture);
    expect(audit).toContain("**Event**: REVIEW_REQUESTED");
    expect(audit).toContain("**Event**: REVIEW_COMPLETED");
    expect(audit).toContain(`**Reviewer**: ${REVIEWER}`);
    expect(audit).toContain("**Verdict**: READY");
  });

  // The engine is soft on the verdict and hard on the review having happened, so
  // a NOT-READY receipt still clears THIS precondition. That is correct and
  // deliberate: refusing a NOT-READY approve is the autonomy gate's job, which
  // reads the verdict artefact. Pinned so a later reader does not mistake the
  // engine's softness for the bridge laundering a refusal.
  test("a NOT-READY receipt is recorded as NOT-READY", () => {
    const fixture = buildFixture();
    const receipt = convergeBoardAndBridge(fixture, "NOT-READY");

    expect(receipt.kind).toBe("recorded");
    expect(auditText(fixture)).toContain("**Verdict**: NOT-READY");
  });
});
