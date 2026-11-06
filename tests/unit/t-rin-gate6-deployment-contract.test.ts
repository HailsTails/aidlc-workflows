// Authored policy regression checks only: these never execute deployment commands.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const stage = readFileSync(new URL("../../plugins/rin/stages/operation/rin-gate-6-operate.md", import.meta.url), "utf8");
const adopting = readFileSync(new URL("../../plugins/rin/knowledge/rin-gates/ADOPTING.md", import.meta.url), "utf8");

describe("Gate 6 project deployment boundary", () => {
  test("requires the project procedure instead of a provider-specific recipe", () => {
    expect(stage).toContain("memory/project.md");
    expect(stage).toContain("## Deployment");
    expect(stage).toContain("procedure is missing, ambiguous or contradictory");
    expect(stage).not.toMatch(/Docker Compose|unreachable over ssh|--dry-run|built images|whole stack|origin\/main/);
  });

  test("observes merge-triggered delivery before deciding whether a trigger is needed", () => {
    expect(stage).toContain("Observe an existing CI/CD run before requesting another");
    expect(stage).toContain("Do not redeploy a release already serving correctly");
    expect(stage).toContain("pending, failed, skipped, superseded or unconfirmed");
    expect(stage).toContain("Read back an uncertain result before retrying");
  });

  test("requires runtime identity and actual behavior, not merely an upload or exit code", () => {
    expect(stage).toContain("uploaded version is not proof that it is serving traffic");
    expect(stage).toContain("source revision, build/release identity and serving runtime");
    expect(stage).toContain("Force the real path; read the side-effect");
    expect(stage).toContain("smoke checks");
    expect(stage).toContain("rollback");
  });

  test("retains governance, all four artifacts and the engine completion owner", () => {
    expect(stage).toContain("approval_mode: autonomous");
    expect(stage).toContain("reserved-decisions.md");
    expect(stage).toContain("rin-deployment-log");
    expect(stage).toContain("rin-health-check-report");
    expect(stage).toContain("rin-operational-runbook");
    expect(stage).toContain("rin-bookkeeping-close");
    expect(stage).toContain("No done-signal without a closed record");
    expect(stage).toContain("report --result approved");
    expect(stage).toContain("committed audit event");
    expect(stage).toContain("No DB state-transition call");
  });

  test("optional rollup cannot become an undeclared deployment prerequisite", () => {
    expect(stage).toContain("optional life-OS rollup failure does not block deployment");
    expect(stage).toContain("project procedure explicitly requires");
    expect(stage).not.toContain("a life-OS rollup call (e.g. `done_check_task`) this Slice's WorkItem depends");
  });

  test("adoption specifies the procedure source without inventing a command for CI/CD", () => {
    expect(adopting).toContain("### Deployment procedure");
    expect(adopting).toContain("source revision, build/release identity and serving runtime");
    expect(adopting).toContain("unconfigured `deployCommand` does not block observation");
    expect(adopting).toContain("does not authorize deployment");
    expect(adopting).not.toContain("deploys the target; total and idempotent");
  });
});
const rinProject = readFileSync(new URL("../fixtures/rin-deployment-procedures/rin/project.md", import.meta.url), "utf8");
const rin = readFileSync(new URL("../fixtures/rin-deployment-procedures/rin/deployment.md", import.meta.url), "utf8");
const minuteSarahProject = readFileSync(new URL("../fixtures/rin-deployment-procedures/minutesarah/project.md", import.meta.url), "utf8");
const minuteSarah = readFileSync(new URL("../fixtures/rin-deployment-procedures/minutesarah/deployment.md", import.meta.url), "utf8");

describe("local project procedure examples (not deployment execution)", () => {
  test("both project pointers resolve to procedures covering the adoption contract", () => {
    expect(rinProject).toContain("(deployment.md)");
    expect(minuteSarahProject).toContain("(deployment.md)");
    for (const procedure of [rin, minuteSarah]) {
      expect(procedure).toContain("## Target and currency");
      expect(procedure).toContain("## Delivery and authority");
      expect(procedure).toContain("## Verification");
      expect(procedure).toContain("## Recovery");
      expect(procedure).toContain("## Operation");
    }
  });

  test("Rin retains lane-wide scope, per-image currency and the existing command", () => {
    expect(rin).toContain("before selecting a Slice");
    expect(rin).toContain("including when the pool is empty or a Slice is parked");
    expect(rin).toContain("each running image");
    expect(rin).toContain("Current checkout plus stale image is still behind");
    expect(rin).toContain("pnpm rin-gates:deploy");
    expect(rin).toContain("converges the whole stack");
    expect(rin).toContain("not an offline fixture command");
  });

  test("MinuteSarah distinguishes successful upload, pending delivery and serving traffic", () => {
    expect(minuteSarah).toContain("Observe the existing merge-triggered run first");
    expect(minuteSarah).toContain("A pending run is followed, not replaced");
    expect(minuteSarah).toContain("its version receives no traffic");
    expect(minuteSarah).toContain("green workflow with skipped production jobs");
    expect(minuteSarah).toContain("needs no deployCommand binding");
    expect(minuteSarah).not.toMatch(/Docker Compose|SSH|pnpm rin-gates:deploy/);
  });

  test("MinuteSarah keeps state-aware recovery and current authority unresolved rather than granting it", () => {
    expect(minuteSarah).toContain("partial apply needs its own state-aware procedure");
    expect(minuteSarah).toContain("Migrations and current routes remain applied");
    expect(minuteSarah).toContain("inspect automatic rollback and read back its result");
    expect(minuteSarah).toContain("the intended Slice is not shipped");
    expect(minuteSarah).toContain("before an agent initiates a new production action");
    expect(minuteSarah).toContain("do not invent live purchases");
  });
});
describe("packaged Gate 6 policy (run scripts/package.ts first)", () => {
  test.each([
    ["claude", "claude"],
    ["codex", "codex"],
    ["copilot", "copilot"],
    ["cursor", "cursor"],
    ["kiro", "kiro/.kiro/aidlc-plugins/aidlc-rin"],
    ["kiro-ide", "kiro-ide/.kiro/aidlc-plugins/aidlc-rin"],
    ["opencode", "opencode"],
  ])("%s receives the project boundary without provider assumptions", (_harness, directory) => {
    const projected = readFileSync(new URL(`../../dist/plugins/rin/${directory}/stages/operation/rin-gate-6-operate.md`, import.meta.url), "utf8");
    expect(projected).toContain("## Deployment");
    expect(projected).toContain("Observe an existing CI/CD run before requesting another");
    expect(projected).toContain("uploaded version is not proof that it is serving traffic");
    expect(projected).toContain("No done-signal without a closed record");
    expect(projected).not.toMatch(/Docker Compose|unreachable over ssh|total and idempotent/);
  });
});