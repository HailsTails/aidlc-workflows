import { describe, expect, test } from "bun:test";
import { readOrchestratorLauncherOptions, decodeOrchestratorRequest, parseReportFlags } from "../../core/tools/aidlc-orchestrator-request.ts";
import { completionCommands, observeReportCommands } from "../../core/tools/aidlc-report-command.ts";

const context = { cwd: process.cwd() };
const decoded = (command: string) => observeReportCommands({ command, context }).map((operation) => operation.request);

describe("one orchestrator report grammar", () => {
  test.each(["approved", "completed", "complete", "done"])("retains the %s lexeme", (result) => {
    expect(decodeOrchestratorRequest({ argv: ["report", "--result", result] })).toMatchObject({ kind: "report", flags: { result }, forward: result === "approved" ? "approval" : "completion" });
  });
  test("duplicate scalars use the last and repeated evidence keeps order", () => {
    expect(parseReportFlags(["--result", "approved", "--result", "rejected", "--stage", "A", "--stage", "B", "--fix-finding", "1", "--fix-finding", "2"])).toEqual({ result: "rejected", stage: "B", fixFindings: ["1", "2"] });
    expect(completionCommands({ command: "aidlc engine orchestrate report --result approved --result rejected", context })).toHaveLength(0);
    expect(completionCommands({ command: "aidlc engine orchestrate report --result rejected --result approved", context })).toHaveLength(1);
  });
  test.each(["--intent", "--space", "--unknown"])("%s remains invalid, not a selector", (flag) => {
    expect(decodeOrchestratorRequest({ argv: ["report", flag, "other", "--result", "approved"] })).toMatchObject({ kind: "invalid" });
  });
  test("malformed flags retain the original diagnostic", () => {
    expect(parseReportFlags(["--stage"]).parseError).toContain("requires a stage name");
    expect(parseReportFlags(["--result", "--stage", "B"]).parseError).toContain('does not accept "B"');
  });
  test("stance precedes outcome but single precedes stance", () => {
    expect(decodeOrchestratorRequest({ argv: ["report", "--skeleton-stance", "off", "--result", "approved"] })).toMatchObject({ kind: "report", branch: "stance", forward: null });
    expect(decodeOrchestratorRequest({ argv: ["report", "--single", "--skeleton-stance", "off", "--result", "done"] })).toMatchObject({ kind: "report", branch: "single", forward: "completion" });
  });
  test("launcher last-value semantics and next literal text are shared with settlement", () => {
    expect(readOrchestratorLauncherOptions(["report", "--project-dir", "A", "--project-dir", "B"]).projectDir).toBe("B");
    expect(readOrchestratorLauncherOptions(["next", "--", "explain", "--project-dir", "B"]).projectDir).toBeUndefined();
    expect(readOrchestratorLauncherOptions(["next", "explain", "--project-dir", "B"]).projectDir).toBeUndefined();
  });
});

describe("literal host adapters use the real dispatcher", () => {
  test.each([
    "aidlc engine orchestrate report", "aidlc.exe engine orchestrate report", '"C:\\Program Files\\aidlc.exe" engine orchestrate report',
    "bun .claude/tools/aidlc.ts engine orchestrate report", "bun .claude/tools/aidlc-orchestrate.ts report", "& aidlc.exe engine orchestrate report",
  ])("%s decodes exact quoted values", (prefix) => {
    expect(decoded(prefix + ' --stage "rin-gate-4-implement" --reason "--stage rin-gate-0-reconcile" --result done')[0]).toMatchObject({ kind: "report", flags: { stage: "rin-gate-4-implement", reason: "--stage rin-gate-0-reconcile", result: "done" } });
  });
  test("a preload path is not the executed script", () => {
    expect(decoded("bun --require .claude/tools/aidlc.ts other.ts engine orchestrate report --result approved")).toHaveLength(0);
    expect(decoded("bun --require .claude/tools/aidlc.ts .codex/tools/aidlc-orchestrate.ts report --result done")[0]).toMatchObject({ kind: "invalid" });
  });
  test("quoted traffic and other segments cannot supply a verdict", () => {
    expect(decoded("echo 'aidlc engine orchestrate report --result approved'")).toHaveLength(0);
    expect(completionCommands({ command: "aidlc engine orchestrate report --result rejected; echo --result approved", context })).toHaveLength(0);
    expect(completionCommands({ command: "aidlc engine orchestrate report --result rejected; aidlc engine orchestrate report --result done", context })).toHaveLength(1);
  });
  test("dispatcher refuses equals/duplicate project options while direct keeps its grammar", () => {
    expect(decoded("aidlc --project-dir=other engine orchestrate report --result done")[0]).toMatchObject({ kind: "invalid" });
    expect(decoded("aidlc --project-dir A --project-dir B engine orchestrate report --result done")[0]).toMatchObject({ kind: "invalid" });
    expect(decoded("bun .claude/tools/aidlc-orchestrate.ts report --project-dir A --project-dir B --result done")[0]).toMatchObject({ kind: "report", launcher: { projectDir: "B" } });
  });
});

test("context mutations are explicit unresolved operations, not another target", () => {
  for (const command of [
    "AIDLC_SESSION_OVERRIDE=other aidlc engine orchestrate report --result done",
    "export AIDLC_PROJECT_DIR=other; aidlc engine orchestrate report --result done",
    "AIDLC_PROJECT_DIR=other; aidlc engine orchestrate report --result done",
    "$env:AIDLC_PROJECT_DIR='other'; aidlc engine orchestrate report --result done",
    "cd $OTHER; aidlc engine orchestrate report --result done",
    "aidlc engine orchestrate report --reason $REASON --result done",
  ]) expect(decoded(command)[0]).toMatchObject({ kind: "invalid" });
});

test("dispatcher delimiter uses captured project environment, never the observer's ambient root", () => {
  const operation = observeReportCommands({
    command: "AIDLC_PROJECT_DIR=other aidlc engine orchestrate report --result done --",
    context: { cwd: process.cwd(), environment: { AIDLC_PROJECT_DIR: "ambient" } },
  })[0];
  expect(operation.request).toMatchObject({ kind: "report", launcher: { projectDir: require("node:path").resolve(process.cwd(), "other") } });
});

test("relative directory prefixes are resolved from captured command cwd", () => {
  const operation = observeReportCommands({ command: "cd ../other && aidlc engine orchestrate report --result done", context: { cwd: process.cwd(), environment: {} } })[0];
  expect(operation.context.cwd).toBe(require("node:path").resolve(process.cwd(), "../other"));
});
test("omitted environment captures the same ambient project as runtime", () => {
  const prior = process.env.AIDLC_PROJECT_DIR;
  process.env.AIDLC_PROJECT_DIR = "ambient-project";
  try {
    const operation = observeReportCommands({ command: "aidlc engine orchestrate report --result done --", context: { cwd: process.cwd() } })[0];
    expect(operation.request).toMatchObject({ kind: "report", launcher: { projectDir: require("node:path").resolve(process.cwd(), "ambient-project") } });
  } finally {
    if (prior === undefined) delete process.env.AIDLC_PROJECT_DIR;
    else process.env.AIDLC_PROJECT_DIR = prior;
  }
});
