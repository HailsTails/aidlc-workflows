
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AIDLC_SRC } from "../harness/fixtures.ts";

const SETTINGS = join(AIDLC_SRC, "settings.json");
const SETTINGS_LOCAL_EXAMPLE = join(AIDLC_SRC, "settings.local.json.example");
const SOURCE_INVOKE = 'bun "$CLAUDE_PROJECT_DIR/.claude/tools/aidlc.ts"';

interface HookEntry {
  type?: string;
  command?: string;
}
interface HookGroup {
  matcher?: string;
  hooks?: HookEntry[];
}
interface Settings {
  hooks?: Record<string, HookGroup[]>;
  statusLine?: { type?: string; command?: string };
  permissions?: { allow?: string[] };
}

function readSettings(): Settings {
  return JSON.parse(readFileSync(SETTINGS, "utf-8")) as Settings;
}

describe("t40 settings.json hook/statusline/permissions config (migrated from t40-settings-hook-config.sh, plan 6, mechanism none)", () => {
  test("T1: hooks.SessionStart is a non-empty array [.sh test 1]", () => {
    const s = readSettings();
    const groups = s.hooks?.SessionStart;
    expect(Array.isArray(groups)).toBe(true);
    expect((groups ?? []).length).toBeGreaterThan(0);
  });

  test("T2: SessionStart wires the source-channel session-start hook command [.sh test 2]", () => {
    const s = readSettings();
    const commands = (s.hooks?.SessionStart ?? []).flatMap((g) =>
      (g.hooks ?? []).map((h) => h.command ?? ""),
    );
    expect(commands).toContain(`${SOURCE_INVOKE} engine hook session-start`);
  });

  test("T3: statusLine.type is 'command' [.sh test 3]", () => {
    expect(readSettings().statusLine?.type).toBe("command");
  });

  test("T4: statusLine.command uses the source-channel statusline route [.sh test 4]", () => {
    expect(readSettings().statusLine?.command).toBe(`${SOURCE_INVOKE} engine statusline`);
  });

  test("T5: permissions allow required narrow commands without blanket Bash", () => {
    const allow = readSettings().permissions?.allow ?? [];
    expect(allow).toContain("Bash(bun .claude/tools/*)");
    expect(allow).toContain("Bash(date -u *)");
    expect(allow).toContain('Bash(bun "$CLAUDE_PROJECT_DIR/.claude/tools/"*)');
    expect(allow).toContain('Bash(bun "$CLAUDE_PROJECT_DIR/.claude/hooks/"*)');
    expect(allow).toContain('Bash(node "$CLAUDE_PROJECT_DIR/.claude/hooks/"*)');
    expect(allow).toContain("Bash(pnpm run *)");
    expect(allow).toContain("Bash(pnpm -r --if-present run *)");
    expect(allow).not.toContain("Bash(*)");
    expect(allow).not.toContain("Bash(aidlc *)");
    expect(allow).not.toContain("Bash");
  });

  test("T6: settings.local.json.example is valid JSON [.sh test 6]", () => {
    const text = readFileSync(SETTINGS_LOCAL_EXAMPLE, "utf-8");
    expect(() => JSON.parse(text)).not.toThrow();
    const parsed = JSON.parse(text) as unknown;
    expect(typeof parsed).toBe("object");
    expect(parsed).not.toBeNull();
  });
});
