// Authored-contract checks, not proof that a model followed the instructions.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const stage = readFileSync(
  new URL("../../plugins/rin/stages/inception/rin-gate-0-reconcile.md", import.meta.url),
  "utf8",
);
const adopting = readFileSync(
  new URL("../../plugins/rin/knowledge/rin-gates/ADOPTING.md", import.meta.url),
  "utf8",
);
const owners = JSON.parse(
  readFileSync(
    new URL("../../plugins/rin/tools/rin-gates/transition-owners.json", import.meta.url),
    "utf8",
  ),
);
const localProject = readFileSync(
  new URL("../fixtures/rin-gate0-procedures/local-project.md", import.meta.url),
  "utf8",
);
const scheduledProject = readFileSync(
  new URL("../fixtures/rin-gate0-procedures/scheduled-project.md", import.meta.url),
  "utf8",
);

describe("Gate 0 obligation boundaries", () => {
  test("existing work follows its real record without invented intake", () => {
    expect(stage).toContain("An existing engine intent needs its");
    expect(stage).toContain("fabricated capture, promotion, or queue measurement");
    expect(stage).toContain("intent goes directly to Step 2 unless the run also owns an intake sweep");
    expect(stage).toContain("record creation alone does not prove capture closure");
  });

  test("assignment and project policy apply without an implicit local fallback", () => {
    expect(stage).toContain("memory/project.md");
    expect(stage).toContain("## Gate 0");
    expect(stage).toContain("Missing or contradictory assignment/policy");
    expect(stage).toContain("local-completion default or pick a different scope");
    expect(adopting).toContain("not an implicit");
    expect(adopting).toContain("backlogStore` label or the local `configBacklogStore` default is not a working");
  });

  test("assigned sweeps keep measurement, totality, reservoir and alarm requirements", () => {
    expect(stage).toContain("Selecting an existing intent during that run does not remove");
    expect(stage).toContain("UNMEASURED is never rendered as 0");
    expect(stage).toContain("Opened-count equals dispositioned-count");
    expect(stage).toContain("When assigned an intake sweep, its resolver also owns");
    expect(stage).toContain("Every assigned intake sweep, scheduled or ad-hoc");
    expect(stage).toContain("it never blocks, aborts, or gates");
    expect(stage).toContain("never call that intake sweep healthy");
    expect(stage).not.toContain("## The per-run contract (every run, forever)");
  });

  test("local recording is explicit and never proves publication", () => {
    expect(stage).toContain("NOT REQUESTED: no push or PR performed");
    expect(stage).toContain("No forge binding is needed");
    expect(stage).toContain("local coherence is not publication");
    expect(localProject).toContain("No intake sweep is assigned");
    expect(localProject).toContain("no push or PR is requested");
    expect(localProject).toContain("remain UNMEASURED");
  });

  test("required publication holds without its binding or authority", () => {
    expect(stage).toContain("A scheduled lane's durable-push rule");
    expect(stage).toContain("Read back the remote head and PR identity");
    expect(stage).toContain("missing binding, denied action or uncertain result");
    expect(stage).toContain("Read back uncertainty before retrying");
    expect(stage).toContain("required capture closure and publication are complete");
    expect(stage).toContain("Review binds to the finished work, not the earlier publication head");
    expect(scheduledProject).toContain("Same-run branch push and PR are required");
    expect(scheduledProject).toContain("cannot authorize publication");
    expect(stage).not.toContain("Commit, push, and open the PR - same run, never at the primary");
  });

  test("transition ownership remains intake without granting extra capabilities", () => {
    const owner = owners.transitions["spec-drafted"];
    expect(owner.gate).toBe("rin-gate-0-reconcile");
    expect(owner.owningLane).toBe("intake");
    expect(owner.requiredCapabilities).toEqual(["record-dir write + commit"]);
    expect(owner.note).toContain("Missing required integration or authority remains HOLD");
  });

  test("review, authority and one-way record ownership remain required", () => {
    expect(stage).toContain("reviewer: rin-stage-reviewer-agent");
    expect(stage).toContain("approval_mode: autonomous");
    expect(stage).toContain("reserved-decision list and the user's actual instruction");
    expect(stage).toContain("source identity, attempt freshness, approval policy or conductor ritual");
    expect(stage).toContain("Do not emit a READY review verdict yourself");
    expect(stage).toContain("bypass a real negative review");
    expect(stage).toContain("sole state authority");
    expect(stage).toContain("No hand-minting");
  });
});

describe("packaged Gate 0 obligations (run scripts/package.ts first)", () => {
  test.each([
    ["claude", "claude"],
    ["codex", "codex"],
    ["copilot", "copilot"],
    ["cursor", "cursor"],
    ["kiro", "kiro/.kiro/aidlc-plugins/aidlc-rin"],
    ["kiro-ide", "kiro-ide/.kiro/aidlc-plugins/aidlc-rin"],
    ["opencode", "opencode"],
  ])("%s receives all three obligations and the same authority boundary", (_harness, directory) => {
    const projected = readFileSync(
      new URL(`../../dist/plugins/rin/${directory}/stages/inception/rin-gate-0-reconcile.md`, import.meta.url),
      "utf8",
    );
    expect(projected).toContain("## Establish the applicable work before acting");
    expect(projected).toContain("**Selected-work reconciliation, always.**");
    expect(projected).toContain("**Intake sweep, when assigned.**");
    expect(projected).toContain("**Publication, as the project requires.**");
    expect(projected).toContain("Do not emit a READY review verdict yourself");
  });
});
