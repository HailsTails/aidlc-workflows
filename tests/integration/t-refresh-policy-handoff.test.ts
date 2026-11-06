// covers: tool:aidlc-init, file:core/tools/aidlc-workflow-refresh.ts
import { expect, test } from "bun:test";
import { createDefaultExecutionPort } from "../../plugins/discipline-core/core/platform-ports/execution-port.ts";
import { absolutePathSchema } from "../../plugins/discipline-core/core/values/absolute-path.ts";
import { createDefaultFixtureWorkspace } from "../harness/fixture-workspace.ts";

test("copied upgrades retain ordinary routing but refuse a policy-dropping handoff", () => {
  using workspace = createDefaultFixtureWorkspace();
  const home = workspace.path("home");
  const project = workspace.path("project");
  const newer = workspace.path("newer");
  workspace.directory("home");
  workspace.directory("project/.git");
  const release = `${import.meta.dir}/../../dist/claude`;
  workspace.copyFrom(release, "project");
  workspace.copyFrom(release, "newer");
  const environment = {
    PATH: process.env.PATH,
    HOME: home,
    USERPROFILE: home,
    APPDATA: workspace.path("home/appdata"),
    LOCALAPPDATA: workspace.path("home/localappdata"),
    XDG_CONFIG_HOME: workspace.path("home/config"),
    XDG_CACHE_HOME: workspace.path("home/cache"),
    TEMP: workspace.root,
    TMP: workspace.root,
    TMPDIR: workspace.root,
    AIDLC_PROJECT_DIR: project,
    CLAUDE_PROJECT_DIR: project,
  };
  const execution = createDefaultExecutionPort({
    policy: {
      executable: process.execPath,
      environment: () => environment,
      timeoutMilliseconds: 120000,
      maximumOutputBytes: 1024 * 1024,
    },
  });
  const own = workspace.path("project/.claude/tools/aidlc.ts");
  const setup = execution.run({
    arguments: [own, "config", "--from", release, "--project-dir", project, "--json"],
    cwd: absolutePathSchema.parse(project),
  });
  expect(setup).toMatchObject({ outcome: "ok", value: { status: 0 } });
  const originalStamp = workspace.read("project/.claude/tools/data/aidlc-stamp.json");
  const stampPath = "newer/.claude/tools/data/aidlc-stamp.json";
  workspace.write(
    stampPath,
    JSON.stringify({ ...JSON.parse(workspace.read(stampPath)), frameworkVersion: "99.0.0" }),
  );
  workspace.write("newer/.claude/tools/aidlc.ts", 'console.log("selected-newer-tool");\n');
  workspace.write(
    "project/policy-probe.ts",
    'import {main} from "./.claude/tools/aidlc-init.ts";\nimport {stageRefreshComparison} from "./.claude/tools/aidlc-stage-refresh-contract.ts";\nawait main(process.argv.slice(2),{refreshPolicy:{id:"synthetic-fixed-policy-v1",compareStages:stageRefreshComparison,notes:()=>[]}});\n',
  );
  const policyRun = execution.run({
    arguments: [
      workspace.path("project/policy-probe.ts"),
      "config",
      "--from",
      newer,
      "--project-dir",
      project,
      "--json",
    ],
    cwd: absolutePathSchema.parse(project),
  });
  expect(policyRun).toMatchObject({ outcome: "ok", value: { status: 4 } });
  expect(JSON.stringify(policyRun)).toContain("cannot be carried to the newer release");
  expect(JSON.stringify(policyRun)).not.toContain("selected-newer-tool");
  expect(workspace.read("project/.claude/tools/data/aidlc-stamp.json")).toBe(originalStamp);
  const genericRun = execution.run({
    arguments: [own, "config", "--from", newer, "--project-dir", project, "--json"],
    cwd: absolutePathSchema.parse(project),
  });
  expect(genericRun).toEqual({
    outcome: "ok",
    value: { status: 0, stdout: "selected-newer-tool\n", stderr: "" },
  });
}, 180000);
