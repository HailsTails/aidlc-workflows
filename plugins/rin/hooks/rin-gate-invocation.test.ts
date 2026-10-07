import { describe, expect, test } from "vitest";
import { gateScopeGridPathOf, gateToolsDirectoryOf, isCompletionReport } from "./rin-gate-invocation.ts";
import { gatedInvocationFrom as constitutionInvocation, runVerdictTool } from "./rin-constitution-gate.ts";
import { gatedInvocationFrom as autonomyInvocation } from "./rin-gates-autonomy-gate.ts";

const completions = [
  "true & aidlc engine orchestrate report --result approved",
  "exec -- aidlc engine orchestrate report --result completed",
  "env -- bun .claude/tools/aidlc-orchestrate.ts report --result approved",
  "aidlc --quiet --json --project-dir /invoking engine orchestrate report --result approved",
  "bun run .claude/tools/aidlc-orchestrate.ts report --result approved",
  "env ROUTE=test bun .codex/tools/aidlc.ts engine orchestrate report --result approved",
  "command aidlc engine orchestrate report --result completed",
  "aidlc --project-dir /invoking engine orchestrate report --result approved",
  "bun .codex/tools/aidlc.ts --project-dir=/invoking engine orchestrate report --result completed",
  "echo ok&&aidlc engine orchestrate report --result approved",
  "bun .codex/tools/aidlc.ts engine orchestrate report --result approved",
  "bun .claude/tools/aidlc.ts engine orchestrate report --result completed",
  'bun "/installed path/.codex/tools/aidlc.ts" engine orchestrate report --stage gate-4 --result approved',
  "& bun 'C:\\installed path\\.codex\\tools\\aidlc.ts' engine orchestrate report --result completed",
  "aidlc engine orchestrate report --result approved",
  "bun .claude/tools/aidlc-orchestrate.ts report --result approved",
  'bun "/installed path/.codex/tools/aidlc-orchestrate.ts" report --result completed',
  "OTHER=value bun .codex/tools/aidlc.ts engine orchestrate report --result approved && echo done",
];
const controls = [
  "aidlc engine orchestrate next --result approved",
  "aidlc engine orchestrate report --result in_progress",
  "bun .codex/tools/aidlc.ts engine state show --result approved",
  "echo 'aidlc engine orchestrate report --result approved'",
  "printf 'bun .claude/tools/aidlc-orchestrate.ts report --result approved'",
  "aidlc engine orchestrate report --result rejected; echo --result approved",
  "aidlc engine orchestrate report; other --result completed",
  "aidlc engine orchestrate report --result rejected\nother --result approved",
  "other engine orchestrate report --result approved",
  "",
];

const verdictSeat = () => {
  const requests: unknown[] = [];
  return {
    requests,
    ports: {
      clock: { nowMillis: () => 0 },
      spawnAudit: (request: unknown) => {
        requests.push(request);
        return { kind: "exited" as const, status: 0, stdout: '{"pass":true,"violations_count":0,"violations":[]}' };
      },
    },
  };
};

describe("Rin completion command recognition", () => {
  test.each(completions)("both gates intercept %s", (command) => {
    expect(isCompletionReport({ command })).toBe(true);
    const raw = JSON.stringify({ tool_name: "Bash", tool_input: { command }, cwd: "/invoking" });
    expect(constitutionInvocation({ raw })?.commandCwd).toBe("/invoking");
    expect(autonomyInvocation({ raw })?.cwd).toBe("/invoking");
  });
  test.each(controls)("both gates ignore %s", (command) => {
    expect(isCompletionReport({ command })).toBe(false);
    const raw = JSON.stringify({ tool_name: "Bash", tool_input: { command } });
    expect(constitutionInvocation({ raw })).toBeNull();
    expect(autonomyInvocation({ raw })).toBeNull();
  });
  test("PowerShell uses the same predicate and nonshell tools stay outside it", () => {
    const payload = { tool_input: { command: completions[0] } };
    expect(autonomyInvocation({ raw: JSON.stringify({ ...payload, tool_name: "PowerShell" }) })).not.toBeNull();
    expect(constitutionInvocation({ raw: JSON.stringify({ ...payload, tool_name: "Write" }) })).toBeNull();
  });
});

describe("required-host gate assets", () => {
  test.each([".claude", ".codex"])("resolves %s sibling assets while auditing the invoking checkout", (host) => {
    const hookDirectory = "/producer/" + host + "/hooks";
    const tools = gateToolsDirectoryOf({ hookDirectory, checkoutRoot: "/invoking" });
    expect(tools).toBe("/producer/" + host + "/tools");
    expect(gateScopeGridPathOf({ hookDirectory, checkoutRoot: "/invoking" })).toBe("/invoking/" + host + "/tools/data/scope-grid.json");
    const seat = verdictSeat();
    const outcome = runVerdictTool({
      scriptName: "rin-harness-constitution-audit.ts", auditRoot: "/invoking", hookDirectory,
      windows: { coldMs: 1, warmMs: 2 }, assetExists: () => true,
      ports: seat.ports,
    });
    expect(outcome.kind).toBe("spoke");
    expect(seat.requests).toEqual([{ scriptPath: tools + "/rin-harness-constitution-audit.ts", auditRoot: "/invoking", timeoutMs: 1 }]);
  });
  test("missing installed assets refuse before spawning instead of borrowing Claude assets", () => {
    const seat = verdictSeat();
    const outcome = runVerdictTool({
      scriptName: "rin-harness-constitution-audit.ts", auditRoot: "/invoking", hookDirectory: "/producer/.codex/hooks",
      windows: { coldMs: 1, warmMs: 2 }, assetExists: () => false,
      ports: seat.ports,
    });
    expect(outcome).toEqual({ kind: "unavailable", scriptName: "rin-harness-constitution-audit.ts", reason: "not found at /producer/.codex/tools/rin-harness-constitution-audit.ts" });
    expect(seat.requests).toEqual([]);
  });
});
