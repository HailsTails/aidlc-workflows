// covers: tool:aidlc-init, function:compileWorkflowCandidate, function:readWorkflowCompilationRequest
import { afterEach, describe, expect, test, setDefaultTimeout } from "bun:test";
import { z } from "zod";
import { preservedUserState, projectSnapshot, runConfig } from "../harness/install-adoption.ts";
import { installedCommand, pluginState } from "../harness/install-plugin-refresh.ts";
import { NATIVE_FIXTURE_SETUP_TIMEOUT_MS } from "../harness/test-budget.ts";
import { cleanupWorkflowFixtures, COMPOSED_SCOPE_NAME, createWorkflowRefreshFixture,
  fixtureFileTexts, fixturePathStatus, readFixtureText, writeWorkflowPrivateState } from "../harness/workflow-candidate-fixtures.ts";

setDefaultTimeout(NATIVE_FIXTURE_SETUP_TIMEOUT_MS);
const graphSchema = z.array(z.object({ slug: z.string(), enabled: z.boolean().optional(),
  rules_in_context: z.array(z.object({ path: z.string(), scope: z.string() })),
  sensors_applicable: z.array(z.object({ id: z.string(), path: z.string() }).passthrough()),
}));

afterEach(cleanupWorkflowFixtures, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

describe("completed workflow candidate refresh", () => {
  test("Completed work admits dry-run and refresh while preserving plugin sensors, private rules and composed scopes", () => {
    const fixture = createWorkflowRefreshFixture();
    const installed = runConfig({ fixture, runner: fixture.packagedRunner, options: ["--yes"] });
    expect(installed.status, installed.stdout + installed.stderr).toBe(0);
    const selected = installedCommand({ fixture, command: "select", selection: "aidlc,test-pro" });
    expect(selected.status, selected.stdout + selected.stderr).toBe(0);
    const synced = installedCommand({ fixture, command: "sync" });
    expect(synced.status, synced.stdout + synced.stderr).toBe(0);
    const privateState = writeWorkflowPrivateState(fixture, "Completed");
    const userState = preservedUserState(fixture.project);
    const before = projectSnapshot(fixture.project);
    const dryRun = runConfig({ fixture, options: ["--dry-run"] });
    expect(dryRun.status, dryRun.stdout + dryRun.stderr).toBe(0);
    expect(projectSnapshot(fixture.project)).toEqual(before);
    expect(fixturePathStatus({ root: fixture.project, path: `.claude/scopes/aidlc-${COMPOSED_SCOPE_NAME}.md` })).toBe("absent");
    const refresh = runConfig({ fixture, options: ["--yes"] });
    expect(refresh.status, refresh.stdout + refresh.stderr).toBe(0);
    const graph = graphSchema.parse(JSON.parse(readFixtureText(fixture.project, ".claude/tools/data/stage-graph.json")));
    expect(graph).toContainEqual(expect.objectContaining({ slug: "test-pro-integration",
      rules_in_context: expect.arrayContaining([
        { path: "aidlc/spaces/default/memory/team.md", scope: "team" },
        { path: "aidlc/spaces/default/memory/project.md", scope: "project" },
      ]),
    }));
    expect(graph).not.toContainEqual(expect.objectContaining({ slug: "test-pro-integration", enabled: expect.any(Boolean) }));
    expect(graph).toContainEqual(expect.objectContaining({ slug: "build-and-test", sensors_applicable: expect.arrayContaining([
      expect.objectContaining({ id: "coverage-threshold", path: ".claude/sensors/aidlc-coverage-threshold.md" }),
    ]) }));
    const grid = JSON.parse(readFixtureText(fixture.project, ".claude/tools/data/scope-grid.json"));
    expect(grid[COMPOSED_SCOPE_NAME].stages).toEqual(privateState.stages);
    expect(readFixtureText(fixture.project, `.claude/scopes/aidlc-${COMPOSED_SCOPE_NAME}.md`)).toBe(privateState.identity);
    expect(fixtureFileTexts(fixture.project, privateState.privateFiles)).toEqual(privateState.privateFiles);
    expect(preservedUserState(fixture.project)).toEqual(userState);
    expect(pluginState(fixture.project).coreClaimsPlugin).toBe(false);
  });
});

describe("running workflow candidate refresh admission", () => {
  test("Running work refuses the incompatible plugin refresh and leaves every live file untouched", () => {
    const fixture = createWorkflowRefreshFixture();
    const installed = runConfig({ fixture, runner: fixture.packagedRunner, options: ["--yes"] });
    expect(installed.status, installed.stdout + installed.stderr).toBe(0);
    const selected = installedCommand({ fixture, command: "select", selection: "aidlc,test-pro" });
    expect(selected.status, selected.stdout + selected.stderr).toBe(0);
    const synced = installedCommand({ fixture, command: "sync" });
    expect(synced.status, synced.stdout + synced.stderr).toBe(0);
    const privateState = writeWorkflowPrivateState(fixture, "Running");
    const userState = preservedUserState(fixture.project);
    const before = projectSnapshot(fixture.project);
    const dryRun = runConfig({ fixture, options: ["--refresh-open-workflows", "--dry-run"] });
    // Candidate compilation must not override the existing admission owner.
    expect(dryRun.status, dryRun.stdout + dryRun.stderr).toBe(4);
    expect(dryRun.envelope?.message).toContain('stage "build-and-test" changes or disappears');
    expect(projectSnapshot(fixture.project)).toEqual(before);
    expect(fixtureFileTexts(fixture.project, privateState.privateFiles)).toEqual(privateState.privateFiles);
    expect(preservedUserState(fixture.project)).toEqual(userState);
  });
});
