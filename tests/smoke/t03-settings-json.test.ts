
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AIDLC_SRC } from "../harness/fixtures.ts";

const SETTINGS_PATH = join(AIDLC_SRC, "settings.json");
const RAW = readFileSync(SETTINGS_PATH, "utf-8");

interface Settings {
  permissions?: { allow?: string[] };
  statusLine?: { command?: string };
  model?: string;
  effortLevel?: string;
  env?: Record<string, string>;
}
const settings: Settings = JSON.parse(RAW);

describe("settings.json — JSON validity [.sh test 1]", () => {
  test("settings.json is valid JSON", () => {
    expect(() => JSON.parse(RAW)).not.toThrow();
    expect(typeof settings).toBe("object");
    expect(settings).not.toBeNull();
  });
});

describe("permissions.allow — pre-approved tool list [.sh tests 2-9]", () => {
  const allow = settings.permissions?.allow ?? [];
  const REQUIRED_TOOLS = [
    "Read",
    "Edit",
    "Write",
    "Glob",
    "Grep",
    "Task",
    "WebSearch",
  ];
  for (const tool of REQUIRED_TOOLS) {
    test(`permissions.allow contains ${tool}`, () => {
      expect(Array.isArray(allow)).toBe(true);
      expect(allow).toContain(tool);
    });
  }
  test("permissions.allow grants only the Bun copy-channel tool directory", () => {
    expect(allow).toContain("Bash(bun .claude/tools/*)");
    expect(allow).not.toContain("Bash");
    expect(allow).not.toContain("Bash(aidlc *)");
  });
});

describe("statusLine [.sh test 10]", () => {
  test("statusLine.command routes through the Bun copy-channel dispatcher", () => {
    const cmd = settings.statusLine?.command ?? "";
    expect(cmd).toBe('bun "$CLAUDE_PROJECT_DIR/.claude/tools/aidlc.ts" engine statusline');
  });
});

describe("session model and effort inheritance [.sh test 11]", () => {
  test("model and effortLevel keys are absent", () => {
    expect(Object.hasOwn(settings, "model")).toBe(false);
    expect(Object.hasOwn(settings, "effortLevel")).toBe(false);
  });
});

describe("public settings keep provider, region and model selections consumer-owned", () => {
  const env = settings.env ?? {};

  test("does not enable a Bedrock provider", () => {
    expect(env.CLAUDE_CODE_USE_BEDROCK).toBeUndefined();
  });

  test("does not select an AWS region", () => {
    expect(env.AWS_REGION).toBeUndefined();
  });

  test("does not pin the fable model", () => {
    expect(env.ANTHROPIC_DEFAULT_FABLE_MODEL).toBeUndefined();
  });

  test("does not pin the opus model", () => {
    expect(env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBeUndefined();
  });

  test("does not pin the sonnet model", () => {
    expect(env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBeUndefined();
  });

  test("does not pin the haiku model", () => {
    expect(env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBeUndefined();
  });
});
