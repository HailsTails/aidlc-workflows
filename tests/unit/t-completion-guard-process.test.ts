// covers: function:completionOperations, function:resolveCompletionTarget
// Explicitly assembled payload: this is not a test of installer delivery or host registration.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { writeSessionBinding } from "../../core/tools/aidlc-record-core.ts";
const stage = "rin-gate-3-interface-lock";
const chat = "completion-process-chat";
const root = mkdtempSync(join(tmpdir(), "aidlc-completion-consumer-"));
const tools = join(root, ".claude", "tools");
const hooks = join(root, ".claude", "hooks");
const record = join(root, "aidlc", "spaces", "selected", "intents", "bound-00000002");
const environment = { ...process.env };
for (const key of ["AIDLC_PROJECT_DIR", "CLAUDE_PROJECT_DIR", "AIDLC_SESSION_OVERRIDE", "AIDLC_SESSION_OVERRIDE_SOURCE", "CODEX_THREAD_ID", "CLAUDE_CODE_SESSION_ID", "KIRO_SESSION_ID", "AIDLC_HARNESS_DIR", "AIDLC_RIN_GATES_AUTONOMY_BYPASS", "RIN_GATES_TEST_MODE", "RIN_GATES_HEAD_SHA", "RIN_GATES_ROSTER_CONFIG"]) delete environment[key];
environment.AIDLC_SESSION_OVERRIDE = chat;
const write = (path: string, content: string) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content); };
function hook(name: string, command: string) {
  return spawnSync(process.execPath, [join(hooks, name)], { cwd: root, env: environment, encoding: "utf8", timeout: 30_000,
    input: JSON.stringify({ tool_name: "Bash", cwd: root, session_id: chat, tool_input: { command } }) });
}
const autonomy = (command: string) => hook("rin-gates-autonomy-gate.ts", command);
const report = (args = "--result done") => `aidlc engine orchestrate report ${args}`;
let verdictPath: string;
let verdict: string;
beforeAll(async () => {
  cpSync(resolve("dist/claude/.claude/tools"), tools, { recursive: true });
  mkdirSync(hooks, { recursive: true });
  cpSync(resolve("plugins/rin/hooks/review-rosters.json"), join(hooks, "review-rosters.json"));
  const bundle = await Bun.build({
    entrypoints: ["rin-gates-autonomy-gate.ts", "rin-constitution-gate.ts"].map((name) => resolve("plugins/rin/hooks", name)),
    outdir: hooks, target: "bun", naming: "[name].ts",
  });
  if (!bundle.success) throw new Error(bundle.logs.map(String).join("\n"));
  write(join(tools, "data/scope-grid.json"), JSON.stringify({ "rin-gates": { stages: { "rin-gate-5-review-cycle": "EXECUTE" } } }));
  write(join(record, "aidlc-state.md"), `- **Scope**: rin-gates\n- **Current Stage**: ${stage}\n`);
  write(join(root, "aidlc/active-space"), "default");
  write(join(root, "aidlc/spaces/default/intents/active-intent"), "cursor-00000001");
  write(join(root, "aidlc/spaces/default/intents/cursor-00000001/aidlc-state.md"), "- **Scope**: classic\n- **Current Stage**: requirements-analysis\n");
  writeSessionBinding(root, chat, "selected", "bound-00000002", "switch");
  write(join(root, "README.md"), "Isolated completion consumer test.\n");
  for (const args of [["init", "--quiet"], ["add", "README.md"], ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "fixture"]]) {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" }); if (result.status !== 0) throw new Error(result.stderr);
  }
  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim();
  const rosters = JSON.parse(readFileSync(join(hooks, "review-rosters.json"), "utf8"));
  verdictPath = join(record, "inception", stage, "review-verdict.json");
  verdict = JSON.stringify({ gate: stage, emittedBy: "rin-gates-review-verdict", verdict: "READY", headSha: head, lenses: rosters.byGate[stage] ?? rosters.defaultRoster, blockingFindings: [] });
});
afterAll(() => rmSync(root, { recursive: true, force: true }));
test("assembled guard rejects missing review in session-selected record, not cursor", () => {
  const result = autonomy(report()); expect(result.status).toBe(2); expect(result.stderr).toContain("no decorrelated-review verdict"); expect(result.stderr).toContain("bound-00000002");
});
test("assembled guard accepts all forward lexemes with git-bound fixture evidence", () => {
  write(verdictPath, verdict);
  for (const result of ["approved", "completed", "complete", "done"]) { const output = autonomy(report(`--result ${result}`)); expect(output.stderr).toBe(""); expect(output.status).toBe(0); }
});
test("native spelling, copied dispatcher and direct source consume same target", () => {
  for (const prefix of ["aidlc.exe engine orchestrate", "bun .claude/tools/aidlc.ts engine orchestrate", "bun .claude/tools/aidlc-orchestrate.ts"]) {
    const output = autonomy(`${prefix} report --result done --reason "--stage ignored --result rejected"`); expect(output.stderr).toBe(""); expect(output.status).toBe(0);
  }
});
test("duplicate selectors use runtime last-value semantics", () => {
  const output = autonomy(report(`--stage unknown --stage ${stage} --result rejected --result done`)); expect(output.stderr).toBe(""); expect(output.status).toBe(0);
  const refusal = autonomy(report(`--stage ${stage} --stage rin-gate-4-implement --result done`)); expect(refusal.status).toBe(2); expect(refusal.stderr).toContain("rin-gate-4-implement");
});
test("both assembled guard processes refuse malformed or unresolved commands", () => {
  for (const name of ["rin-gates-autonomy-gate.ts", "rin-constitution-gate.ts"]) {
    for (const command of [report("--intent other --result done"), report("--stage"), `AIDLC_SESSION_OVERRIDE=other ${report()}`]) {
      const output = hook(name, command); expect(output.status, output.stderr).toBe(2); expect(output.stderr).not.toBe("");
    }
  }
});
test("closed single-stage work cannot borrow main verdict", () => {
  const output = autonomy(report(`--single --stage ${stage} --result done`)); expect(output.status).toBe(2); expect(output.stderr).toContain(`No open single-stage:${stage}`);
});

test("bundled classifier survives a missing target module without trapping unrelated commands", () => {
  const targetModule = join(tools, "aidlc-report-target.ts");
  const original = readFileSync(targetModule);
  rmSync(targetModule);
  try {
    for (const name of ["rin-gates-autonomy-gate.ts", "rin-constitution-gate.ts"]) {
      for (const command of ["git status", "aidlc update"]) {
        const output = hook(name, command);
        expect(output.stderr).toBe(""); expect(output.status).toBe(0);
      }
      const refusal = hook(name, report());
      expect(refusal.status, refusal.stderr).toBe(2);
      expect(refusal.stderr).toContain("target contract unavailable");
    }
    const bypass = hook("rin-constitution-gate.ts", `AIDLC_CONSTITUTION_BYPASS=1 ${report()}`);
    expect(bypass.status, bypass.stderr).toBe(0);
    environment.AIDLC_RIN_GATES_AUTONOMY_BYPASS = "1";
    const autonomyBypass = autonomy(report());
    expect(autonomyBypass.status, autonomyBypass.stderr).toBe(0);
  } finally {
    delete environment.AIDLC_RIN_GATES_AUTONOMY_BYPASS;
    writeFileSync(targetModule, original);
  }
});

test("core request and target remain usable with the autonomy capability absent", () => {
  const guard = join(hooks, "rin-gates-autonomy-gate.ts");
  const original = readFileSync(guard);
  rmSync(guard);
  try {
    const source = `const {decodeOrchestratorRequest}=await import(${JSON.stringify(join(tools, "aidlc-orchestrator-request.ts"))}); const {resolveReportTarget}=await import(${JSON.stringify(join(tools, "aidlc-report-target.ts"))}); const request=decodeOrchestratorRequest({argv:["report","--result","done"]}); console.log(JSON.stringify(resolveReportTarget({request,context:{cwd:process.cwd(),native:true,sessionId:${JSON.stringify(chat)},environment:process.env}})));`;
    const output = spawnSync(process.execPath, ["-e", source], { cwd: root, env: environment, encoding: "utf8", timeout: 30_000 });
    expect(output.status, output.stderr).toBe(0);
    expect(JSON.parse(output.stdout)).toMatchObject({ kind: "resolved", stage, recordDir: record, unjoined: false });
  } finally { writeFileSync(guard, original); }
});
test("an older target contract cannot silently bypass participation admission", () => {
  const targetModule = join(tools, "aidlc-report-target.ts");
  const original = readFileSync(targetModule);
  writeFileSync(targetModule, 'export const resolveReportTarget = () => ({ kind: "resolved" });');
  try {
    const output = autonomy(report());
    expect(output.status, output.stderr).toBe(2);
    expect(output.stderr).toContain("target contract is incompatible");
  } finally { writeFileSync(targetModule, original); }
});
