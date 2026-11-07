import { describe, expect, test, vi } from "vitest";
import {
  type AuditSpawnOutcome,
  resolveSpawnWindows,
  spawnWithColdStartRetry,
  type VerdictToolPorts,
} from "./rin-constitution-gate.ts";

const SCRIPT_NAME = "rin-harness-constitution-audit.ts";
const SCRIPT_PATH =
  "/fake-root/.claude/tools/rin-harness-constitution-audit.ts";
const AUDIT_ROOT = "/fake-root";

const TIMED_OUT_SPAWN: AuditSpawnOutcome = { kind: "timed-out" };

const PASSING_SPAWN: AuditSpawnOutcome = {
  kind: "exited",
  status: 0,
  stdout: '{"pass":true,"violations_count":0,"violations":[]}',
};

describe("rin-constitution-gate cold-start retry (019f72bc)", () => {
  test("a first-spawn timeout RETRIES and passes when the warm run succeeds", () => {
    const spawnAudit = vi
      .fn<VerdictToolPorts["spawnAudit"]>()
      .mockReturnValueOnce(TIMED_OUT_SPAWN)
      .mockReturnValueOnce(PASSING_SPAWN);
    const nowMillis = vi
      .fn<() => number>()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(4000);

    const outcome = spawnWithColdStartRetry({
      scriptName: SCRIPT_NAME,
      scriptPath: SCRIPT_PATH,
      auditRoot: AUDIT_ROOT,
      windows: { coldMs: 1000, warmMs: 600_000 },
      ports: { spawnAudit, clock: { nowMillis } },
    });

    expect(outcome).toMatchObject({
      kind: "spoke",
      audit: { pass: true, violations: [] },
    });
  });

  test("the warm window outlives the cold one — the retry is granted the warm budget", () => {
    const spawnAudit = vi
      .fn<VerdictToolPorts["spawnAudit"]>()
      .mockReturnValueOnce(TIMED_OUT_SPAWN)
      .mockReturnValueOnce(PASSING_SPAWN);
    const nowMillis = vi
      .fn<() => number>()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(4000);

    spawnWithColdStartRetry({
      scriptName: SCRIPT_NAME,
      scriptPath: SCRIPT_PATH,
      auditRoot: AUDIT_ROOT,
      windows: { coldMs: 1000, warmMs: 600_000 },
      ports: { spawnAudit, clock: { nowMillis } },
    });

    expect(spawnAudit.mock.calls).toEqual([
      [{ scriptPath: SCRIPT_PATH, auditRoot: AUDIT_ROOT, timeoutMs: 1000 }],
      [{ scriptPath: SCRIPT_PATH, auditRoot: AUDIT_ROOT, timeoutMs: 600_000 }],
    ]);
  });

  test("an inverted override cannot invert the ratio — a warm window below cold is raised to cold", () => {
    const windows = resolveSpawnWindows({
      coldOverride: "30000",
      warmOverride: "1",
    });

    expect(windows).toEqual({ coldMs: 30_000, warmMs: 30_000 });
  });

  test("a SECOND timeout still denies — fail-closed is preserved", () => {
    const spawnAudit = vi
      .fn<VerdictToolPorts["spawnAudit"]>()
      .mockReturnValueOnce(TIMED_OUT_SPAWN)
      .mockReturnValueOnce(TIMED_OUT_SPAWN);
    const nowMillis = vi
      .fn<() => number>()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(601_000);

    const outcome = spawnWithColdStartRetry({
      scriptName: SCRIPT_NAME,
      scriptPath: SCRIPT_PATH,
      auditRoot: AUDIT_ROOT,
      windows: { coldMs: 1000, warmMs: 600_000 },
      ports: { spawnAudit, clock: { nowMillis } },
    });

    expect(outcome).toMatchObject({
      kind: "unavailable",
      reason: expect.stringContaining(
        "timed out twice — ran 1000ms cold then 600000ms warm",
      ),
    });
  });
});
