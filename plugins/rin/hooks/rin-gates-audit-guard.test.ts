import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const GUARD = join(HERE, "rin-gates-audit-guard.ts");

type GuardOutcome = {
  readonly exitCode: number;
  readonly stderr: string;
};

const runGuard = (payload: string): Promise<GuardOutcome> =>
  new Promise((resolvePromise, reject) => {
    const child = spawn("bun", [GUARD], { stdio: ["pipe", "pipe", "pipe"] });
    const stderrChunks: string[] = [];
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => stderrChunks.push(chunk));
    child.on("error", reject);
    child.on("close", (code) =>
      resolvePromise({ exitCode: code ?? 0, stderr: stderrChunks.join("") }),
    );
    child.stdin.end(payload);
  });

const writePayload = (filePath: string): string =>
  JSON.stringify({ tool_name: "Write", tool_input: { file_path: filePath } });

const bashPayload = (command: string): string =>
  JSON.stringify({ tool_name: "Bash", tool_input: { command } });

const AUDIT_PATH =
  "aidlc/spaces/default/intents/260701-fixture/audit/nightwing-abc123.md";

describe("rin-gates-audit-guard deny path", () => {
  test("denies a hand Write into an intent audit shard (exit 2)", async () => {
    const outcome = await runGuard(writePayload(AUDIT_PATH));
    expect(outcome.exitCode).toBe(2);
    expect(outcome.stderr).toContain("engine-writable-only");
  });

  test("denies an Edit regardless of slash direction", async () => {
    const outcome = await runGuard(
      writePayload(
        "aidlc\\spaces\\default\\intents\\260701-fixture\\audit\\shard.md",
      ),
    );
    expect(outcome.exitCode).toBe(2);
  });

  test("denies a Bash redirect into an audit shard", async () => {
    const outcome = await runGuard(bashPayload(`echo x > ${AUDIT_PATH}`));
    expect(outcome.exitCode).toBe(2);
  });

  test("denies a mv onto an audit shard (rename evasion)", async () => {
    const outcome = await runGuard(bashPayload(`mv /tmp/x.md ${AUDIT_PATH}`));
    expect(outcome.exitCode).toBe(2);
  });

  test("denies an sed -i in place on an audit shard", async () => {
    const outcome = await runGuard(
      bashPayload(`sed -i 's/a/b/' ${AUDIT_PATH}`),
    );
    expect(outcome.exitCode).toBe(2);
  });
});

describe("rin-gates-audit-guard pass-through path", () => {
  test("allows a Write to a non-audit record file (exit 0)", async () => {
    const outcome = await runGuard(
      writePayload(
        "aidlc/spaces/default/intents/260701-fixture/inception/rin-gate-0-reconcile/rin-reconcile-report.md",
      ),
    );
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stderr).toBe("");
  });

  test("allows a Bash read that merely names an audit shard", async () => {
    const outcome = await runGuard(bashPayload(`cat ${AUDIT_PATH}`));
    expect(outcome.exitCode).toBe(0);
  });

  test("allows an audit-naming command that only silences stderr", async () => {
    const outcome = await runGuard(
      bashPayload(`cat ${AUDIT_PATH} 2>/dev/null`),
    );
    expect(outcome.exitCode).toBe(0);
  });

  test("exits 0 on empty stdin", async () => {
    const outcome = await runGuard("");
    expect(outcome.exitCode).toBe(0);
  });
});

const PROOF_FREE_SHARD = [
  "# AI-DLC Audit Log",
  "",
  "## Session Start",
  "**Timestamp**: 2026-07-30T00:00:00Z",
  "**Event**: SESSION_STARTED",
  "",
  "## Stage Start",
  "**Timestamp**: 2026-07-30T00:00:01Z",
  "**Event**: STAGE_STARTED",
  "",
].join("\n");

const shardCarrying = (event: string): string =>
  [
    "# AI-DLC Audit Log",
    "",
    "## Event",
    "**Timestamp**: 2026-07-30T00:00:02Z",
    `**Event**: ${event}`,
    "",
  ].join("\n");

// THERE IS NO DELETION ALLOWANCE ON THIS GUARD, and these tests pin that so a
// future re-attempt fails loudly rather than silently reopening the hole.
//
// PR #389's decorrelated security review rejected the allowance on two grounds
// (see the guard's own header for the full reasoning):
//
//   1. The engine reads this ledger for REFUSALS, not only approvals —
//      aidlc-lib.ts's GATE_RESOLUTION_EVENTS is {GATE_APPROVED, GATE_REJECTED,
//      QUESTION_ANSWERED}. A shard carrying only GATE_REJECTED holds no
//      "proof" by an approvals-only test, yet deleting it lowers the last
//      resolution and flips humanActedSinceGate from refuse to allow. Erasing
//      a refusal is as good as forging an approval.
//   2. A hook-side content check cannot be bound to the deletion it authorises
//      (TOCTOU): the pipeline is concurrent, and an engine append can land
//      between the guard's read and the unlink.
describe("no deletion allowance — every deletion naming a shard is denied", () => {
  let auditDir = "";
  const shardAt = (name: string): string => join(auditDir, name);

  beforeAll(() => {
    auditDir = join(
      mkdtempSync(join(tmpdir(), "rin-audit-guard-")),
      "intents",
      "260730-fixture",
      "audit",
    );
    mkdirSync(auditDir, { recursive: true });
    writeFileSync(shardAt("telemetry.md"), PROOF_FREE_SHARD, "utf8");
    writeFileSync(
      shardAt("rejected.md"),
      shardCarrying("GATE_REJECTED"),
      "utf8",
    );
    writeFileSync(
      shardAt("approved.md"),
      shardCarrying("GATE_APPROVED"),
      "utf8",
    );
  });

  afterAll(() =>
    rmSync(dirname(dirname(auditDir)), { recursive: true, force: true }),
  );

  const Deletions: ReadonlyArray<readonly [string, () => string]> = [
    ["rm of a telemetry-only shard", () => `rm ${shardAt("telemetry.md")}`],
    [
      "quoted rm of a telemetry-only shard",
      () => `rm "${shardAt("telemetry.md")}"`,
    ],
    [
      "git rm of a telemetry-only shard",
      () => `git rm "${shardAt("telemetry.md")}"`,
    ],
    [
      "rm of a GATE_REJECTED-only shard",
      () => `rm "${shardAt("rejected.md")}"`,
    ],
    ["rm of a GATE_APPROVED shard", () => `rm "${shardAt("approved.md")}"`],
    ["rm -rf of the whole audit dir", () => `rm -rf ${auditDir}/`],
    ["rm of a shard that does not exist", () => `rm "${shardAt("absent.md")}"`],
  ];

  test.each(Deletions)("denies %s", async (_label, command) => {
    const outcome = await runGuard(bashPayload(command()));
    expect(outcome.exitCode).toBe(2);
    expect(outcome.stderr).toContain("engine-writable-only");
  });

  test("denies a chained write hidden behind a deletion", async () => {
    const outcome = await runGuard(
      bashPayload(
        `rm "${shardAt("telemetry.md")}"; echo forged > "${shardAt("approved.md")}"`,
      ),
    );
    expect(outcome.exitCode).toBe(2);
  });

  test("still allows a read of a shard, quoted or bare", async () => {
    const quoted = await runGuard(
      bashPayload(`cat "${shardAt("approved.md")}"`),
    );
    const bare = await runGuard(bashPayload(`cat ${shardAt("approved.md")}`));
    expect([quoted.exitCode, bare.exitCode]).toEqual([0, 0]);
  });
});
