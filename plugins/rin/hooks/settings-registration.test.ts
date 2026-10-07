import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { GUARD_MANIFEST } from "./guard-manifest.ts";
import { parseSettings } from "./settings-parse.ts";

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

const selectedConsumer = mkdtempSync(join(tmpdir(), "rin-settings-selection-"));

beforeAll(() => {
  cpSync(join(repoRoot, "dist", "claude", ".claude"), join(selectedConsumer, ".claude"), { recursive: true });
  const selectionPath = join(selectedConsumer, ".claude", "tools", "data", "harness.json");
  const selection: unknown = JSON.parse(readFileSync(selectionPath, "utf8"));
  if (!selection || typeof selection !== "object" || Array.isArray(selection)) throw new Error("fixture harness selection is invalid");
  writeFileSync(selectionPath, JSON.stringify({ ...selection, plugins: ["aidlc", "rin"] }));
  const result = spawnSync("bun", [join(repoRoot, "dist", "plugins", "rin", "claude", "hooks", "compose.ts")], {
    cwd: selectedConsumer,
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: selectedConsumer,
      AIDLC_PROJECT_DIR: selectedConsumer,
      AIDLC_HARNESS_DIR: ".claude",
      AIDLC_HARNESS_NAME: "claude",
      CLAUDE_PLUGIN_ROOT: join(repoRoot, "dist", "plugins", "rin", "claude"),
    },
    encoding: "utf8",
    timeout: 55_000,
  });
  if (result.status !== 0) throw new Error(`selected Rin fixture composition failed: ${result.stderr || result.stdout}`);
}, 60_000);

afterAll(() => rmSync(selectedConsumer, { recursive: true, force: true }));

const selectedRegistrations = (): readonly {
  readonly matcher: string;
  readonly command: string;
}[] => {
  const parsed = parseSettings(
    readFileSync(join(selectedConsumer, ".claude", "settings.json"), "utf8"),
  );
  if (parsed.outcome === "failed") {
    throw new Error(
      "selected consumer settings.json is not a valid settings shape",
    );
  }
  return parsed.settings.hooks.PreToolUse.map((entry) => ({
    matcher: entry.matcher,
    command: entry.hooks[0]?.command ?? "",
  }));
};

const registrationFor = (runtimePath: string) =>
  selectedRegistrations().find((entry) => entry.command.includes(runtimePath));

const guardIdsWhoseMatcherDrifted = (): readonly string[] =>
  GUARD_MANIFEST.filter(
    (guard) => registrationFor(guard.runtimePath)?.matcher !== guard.matcher,
  ).map((guard) => guard.id);

describe("selected Rin settings.json registers every manifest guard", () => {
  test("the manifest is non-empty, so this cannot pass vacuously", () => {
    expect(GUARD_MANIFEST.length).toBeGreaterThan(0);
  });

  test("every guard is registered with the matcher its manifest declares", () => {
    expect(guardIdsWhoseMatcherDrifted()).toEqual([]);
  });

  test("guard-vault-write covers every file-editing tool", () => {
    expect(registrationFor("guard-vault-write.ts")?.matcher).toBe(
      "Write|Edit|MultiEdit|NotebookEdit",
    );
  });
});

describe("selected Rin settings.json excludes the retired .ts twins", () => {
  test("rin-guard-navigation.ts is absent", () => {
    expect(registrationFor("rin-guard-navigation.ts")).toBeUndefined();
  });

  test("rin-guard-inline-exec.ts is absent", () => {
    expect(registrationFor("rin-guard-inline-exec.ts")).toBeUndefined();
  });

  test("rin-guard-shell-syntax.ts is absent", () => {
    expect(registrationFor("rin-guard-shell-syntax.ts")).toBeUndefined();
  });

  test("rin-guard-github-writes.ts is absent", () => {
    expect(registrationFor("rin-guard-github-writes.ts")).toBeUndefined();
  });
});
