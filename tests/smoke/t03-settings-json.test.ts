
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_SECTIONS } from "../../core/tools/aidlc-command.ts";
import { copyChannelDispatcherCommands } from "../../core/tools/aidlc.ts";
import { RECORDABLE_PROJECT_BYPASSES } from "../../core/tools/aidlc-settings.ts";
import { AIDLC_SRC, REPO_ROOT } from "../harness/fixtures.ts";

// Every read form agents were seen running for "show my settings", "what
// version", "is my setup healthy" and "what is my status", pinned on their own
// so the list cannot lose one.
const SEEN_READ_FORMS = [
  "--status",
  "--version",
  "version",
  "config --help",
  "doctor",
  "--doctor",
  "doctor --verbose",
  "--doctor --verbose",
  "config --show",
  "config --show --json",
  ...CONFIG_SECTIONS.flatMap((section) => [
    `config ${section} --show`,
    `config ${section} --show --json`,
    `config ${section} --help`,
  ]),
];

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

describe("permissions.allow on the native release", () => {
  const nativeAllow = (JSON.parse(
    readFileSync(join(REPO_ROOT, "dist-release", "claude", ".claude", "settings.json"), "utf-8"),
  ) as Settings).permissions?.allow ?? [];
  function nativeEffect(command: string): "allow" | "prompt" {
    return nativeAllow.some((rule) => {
      const m = /^Bash\((.*)\)$/.exec(rule);
      if (!m) return false;
      const glob = m[1].replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[\\s\\S]*");
      return new RegExp(`^${glob}$`).test(command);
    })
      ? "allow"
      : "prompt";
  }
  const check = "AIDLC_DISABLE_REVIEW_FREEZE_HOOK";

  test("the engine prefix and each exact read-only and turn-back-on command are the only AI-DLC entries", () => {
    expect(nativeAllow.filter((entry) => entry.includes("aidlc"))).toEqual([
      "Bash(aidlc engine *)",
      ...copyChannelDispatcherCommands().map((command) => `Bash(aidlc ${command})`),
    ]);
  });

  test("reading a setting, doctor, status, version and turning a check back on run with no prompt", () => {
    for (const form of SEEN_READ_FORMS) {
      expect(nativeEffect(`aidlc ${form}`), form).toBe("allow");
    }
    for (const command of [
      "aidlc engine orchestrate next",
      "aidlc doctor",
      "aidlc --doctor",
      "aidlc status",
      "aidlc --status",
      "aidlc version",
      "aidlc --version",
      "aidlc config --help",
      ...CONFIG_SECTIONS.flatMap((section) => [
        `aidlc config ${section} --show --json`,
        `aidlc config ${section} --help`,
      ]),
      ...RECORDABLE_PROJECT_BYPASSES.map((name) => `aidlc config flags --clear-bypass ${name} --yes`),
    ]) {
      expect(nativeEffect(command), command).toBe("allow");
    }
  });

  test("the guided setup, any config change, turning a check off and the machine commands still prompt", () => {
    for (const command of [
      "aidlc config",
      "aidlc config --yes",
      "aidlc --config",
      "aidlc config models --show --global",
      "aidlc config --pin 2.10.0",
      "aidlc config --unpin",
      "aidlc config --channel preview",
      "aidlc config models --show --json --global",
      "aidlc config models --deciding-effort high --project --yes",
      `aidlc config flags --bypass ${check} --local --yes`,
      `aidlc config flags --bypass ${check} --yes`,
      `aidlc config flags --clear-bypass ${check} --bypass AIDLC_DISABLE_SENSORS --yes`,
      `aidlc config flags --clear-bypass ${check} --yes --bypass AIDLC_DISABLE_SENSORS`,
      `aidlc config flags --clear-bypass ${check} --yes --global`,
      "aidlc config flags --clear-bypass AIDLC_NOT_A_SWITCH --yes",
      "aidlc doctor --fix",
      "aidlc doctor && aidlc update",
      "aidlc update",
      "aidlc use 2.10.0",
      "aidlc uninstall --yes",
      "aidlc system config global set offline true",
    ]) {
      expect(nativeEffect(command), command).toBe("prompt");
    }
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

describe("provider-neutral env block [.sh tests 12-16]", () => {
  const env = settings.env ?? {};

  test("provider, region, and model aliases are absent", () => {
    for (const key of [
      "CLAUDE_CODE_USE_BEDROCK",
      "AWS_REGION",
      "AWS_PROFILE",
      "ANTHROPIC_DEFAULT_FABLE_MODEL",
      "ANTHROPIC_DEFAULT_OPUS_MODEL",
      "ANTHROPIC_DEFAULT_SONNET_MODEL",
      "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    ]) {
      expect(Object.hasOwn(env, key), key).toBe(false);
    }
  });
});
