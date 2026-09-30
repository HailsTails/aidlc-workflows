import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REPO_ROOT } from "../harness/fixtures.ts";

const scratch = mkdtempSync(join(tmpdir(), "aidlc-t342-"));
const distributionRoot = join(REPO_ROOT, "dist");

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

function projectedDocument(path: string): unknown {
  return JSON.parse(readFileSync(join(distributionRoot, path), "utf-8"));
}

function coreCursorProject(): string {
  const root = join(scratch, "core-cursor");
  mkdirSync(join(root, ".git"), { recursive: true });
  const initialized = spawnSync(process.execPath, [
    join(REPO_ROOT, "core", "tools", "aidlc-init.ts"),
    "config",
    "--project-dir", root,
    "--from", join(distributionRoot, "cursor"),
    "--harness", "cursor",
    "--mcp", "none",
    "--yes",
  ], {
    cwd: root,
    encoding: "utf-8",
    env: {
      ...process.env,
      AIDLC_RUNTIME_ROOT: distributionRoot,
      AIDLC_INSTALL_ROOT: join(scratch, "machine"),
    },
    timeout: 30_000,
  });
  expect(initialized.status, initialized.stdout + initialized.stderr).toBe(0);
  return root;
}

describe("optional plugin hook installation boundary", () => {
  test("core Claude registrations do not advertise unselected Rin bodies", () => {
    const settings = projectedDocument("claude/.claude/settings.json");
    expect(JSON.stringify(settings)).not.toContain("guard-navigation.mjs");
    expect(JSON.stringify(settings)).not.toContain("rin-gates-autonomy-gate.ts");
  });

  test("core Codex adapter target map contains no plugin registrations", () => {
    expect(projectedDocument("codex/.codex/hooks/plugin-hook-targets.json")).toEqual({});
  });

  test("core Copilot adapter target map contains no plugin registrations", () => {
    expect(projectedDocument("copilot/.aidlc/hooks/plugin-hook-targets.json")).toEqual({});
  });

  test("core Cursor event map contains no plugin registrations", () => {
    expect(projectedDocument("cursor/.cursor/hooks/plugin-hook-targets.json")).toEqual({});
  });

  test("core OpenCode event rows contain no plugin registrations", () => {
    expect(projectedDocument("opencode/.aidlc/hooks/plugin-hook-rows.json")).toEqual([]);
  });

  test("a fresh core-only Cursor install allows an ordinary shell operation", () => {
    const root = coreCursorProject();
    const guarded = spawnSync(process.execPath, [
      join(root, ".cursor", "hooks", "aidlc-cursor-adapter.ts"),
      "guards",
    ], {
      cwd: root,
      encoding: "utf-8",
      env: {
        ...process.env,
        AIDLC_PROJECT_DIR: root,
        AIDLC_HARNESS_DIR: ".cursor",
      },
      input: JSON.stringify({
        hook_event_name: "preToolUse",
        tool_name: "Shell",
        tool_input: { command: "echo hook-selection-probe", cwd: root },
        cwd: root,
        workspace_roots: [root],
        session_id: "core-cursor-session",
        conversation_id: "core-cursor-session",
      }),
      timeout: 30_000,
    });
    expect(guarded.status, guarded.stderr).toBe(0);
    expect(JSON.parse(guarded.stdout)).toEqual({ permission: "allow" });
  }, 60_000);
});
