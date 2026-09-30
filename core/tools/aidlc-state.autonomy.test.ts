import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanupTestProject,
  createTestProject,
  seededStateFile,
  seedStateFile,
} from "../../tests/harness/fixtures.ts";
import type { GraphStage } from "./aidlc-graph.ts";
import shippedStages from "../../dist/claude/.claude/tools/data/stage-graph.json";

const toolDirectory = dirname(fileURLToPath(import.meta.url));
const stateTool = join(toolDirectory, "aidlc-state.ts");
const shippedDataDirectory = join(
  toolDirectory,
  "..",
  "..",
  "dist",
  "claude",
  ".claude",
  "tools",
  "data",
);
const shippedScopeGrid = join(shippedDataDirectory, "scope-grid.json");
const fixtureProjects: string[] = [];

type ApprovalMode = NonNullable<GraphStage["approval_mode"]>;

type Fixture = {
  readonly projectDirectory: string;
  readonly environment: NodeJS.ProcessEnv;
};

type StateResult = {
  readonly status: number;
  readonly output: string;
};

function createFixture({
  approvalMode,
}: {
  readonly approvalMode: ApprovalMode;
}): Fixture {
  const projectDirectory = createTestProject();
  fixtureProjects.push(projectDirectory);
  seedStateFile(projectDirectory, "state-mid-ideation.md");

  const graphPath = join(projectDirectory, "stage-graph.json");
  writeFileSync(
    graphPath,
    JSON.stringify(
      shippedStages.map((stage) =>
        stage.slug === "feasibility"
          ? { ...stage, approval_mode: approvalMode }
          : stage,
      ),
    ),
  );

  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    AIDLC_ALLOW_DIRECT_STATE_TRANSITIONS: "1",
    AIDLC_SKIP_ARTIFACT_GUARD: "1",
    AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD: "1",
    AIDLC_STAGE_GRAPH: graphPath,
    AIDLC_SCOPE_MAPPING: shippedScopeGrid,
  };
  delete environment.AIDLC_SKIP_HUMAN_PRESENCE_GUARD;

  return { projectDirectory, environment };
}

function runState({
  fixture,
  args,
  environment = fixture.environment,
}: {
  readonly fixture: Fixture;
  readonly args: readonly string[];
  readonly environment?: NodeJS.ProcessEnv;
}): StateResult {
  const result = spawnSync(
    process.execPath,
    [stateTool, ...args, "--project-dir", fixture.projectDirectory],
    { encoding: "utf-8", env: environment },
  );
  return {
    status: result.status ?? -1,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

function openGate({ fixture }: { readonly fixture: Fixture }): void {
  const result = runState({ fixture, args: ["gate-start", "feasibility"] });
  expect(result.status, result.output).toBe(0);
}

afterEach(() => {
  fixtureProjects
    .splice(0)
    .forEach((projectDirectory) => {
      cleanupTestProject(projectDirectory);
    });
});

describe("aidlc-state autonomous stage approval", () => {
  test("an autonomous Ideation stage approves without a human choice or presence", () => {
    const fixture = createFixture({ approvalMode: "autonomous" });
    openGate({ fixture });

    const result = runState({ fixture, args: ["approve", "feasibility"] });

    expect(result.status, result.output).toBe(0);
    expect(
      readFileSync(seededStateFile(fixture.projectDirectory), "utf-8"),
    ).toContain("- [x] feasibility — EXECUTE");
  });

  test("a human Ideation stage refuses approval without fresh human presence", () => {
    const fixture = createFixture({ approvalMode: "human" });
    openGate({ fixture });

    const result = runState({
      fixture,
      args: ["approve", "feasibility", "--user-input", "Approve"],
    });

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("no new human reply");
  });

  test("autonomous approval still requires summary confirmation evidence", () => {
    const fixture = createFixture({ approvalMode: "autonomous" });
    const statePath = seededStateFile(fixture.projectDirectory);
    writeFileSync(
      statePath,
      readFileSync(statePath, "utf-8").replace(
        "- [-] feasibility — EXECUTE",
        "- [?] feasibility — EXECUTE",
      ),
    );
    const environment = { ...fixture.environment };
    delete environment.AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD;

    const result = runState({
      fixture,
      args: ["approve", "feasibility"],
      environment,
    });

    expect(result.status).not.toBe(0);
    expect(result.output).toContain(
      "record the consolidated summary checkpoint",
    );
  });
});


describe("aidlc-state autonomous stage revision", () => {
  test("an autonomous Ideation stage records an explicitly assistant-authored rejection", () => {
    const fixture = createFixture({ approvalMode: "autonomous" });
    openGate({ fixture });

    const result = runState({
      fixture,
      args: [
        "reject",
        "feasibility",
        "--feedback",
        "The assistant chose this rejection. Correct the unresolved interface contract.",
      ],
    });

    expect(result.status, result.output).toBe(0);
    expect(
      readFileSync(seededStateFile(fixture.projectDirectory), "utf-8"),
    ).toContain("- [R] feasibility — EXECUTE");
  });

  test("a human Ideation stage still requires fresh human presence for rejection", () => {
    const fixture = createFixture({ approvalMode: "human" });
    openGate({ fixture });

    const result = runState({
      fixture,
      args: [
        "reject",
        "feasibility",
        "--user-input",
        "Request Changes",
        "--feedback",
        "The assistant chose this rejection. Correct the unresolved interface contract.",
      ],
    });

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("no new human reply");
  });
});
