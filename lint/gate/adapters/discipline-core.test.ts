import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { disciplineCore, INSTALL_LINK, installedCommit } from "./discipline-core.ts";

const SANDBOX = join(import.meta.dir, "../../../.cache/gate-tests", randomUUID());
const INSTALL = join(SANDBOX, "install");
const IDLE_RUNNER = { capture: () => ({ exitCode: 0, output: "" }), captureAll: async () => [],
    attach: () => 0 };

const git = (args: readonly string[]): string =>
  Bun.spawnSync(["git", "-c", "user.email=gate@test", "-c", "user.name=gate", ...args], {
    cwd: INSTALL,
    stdout: "pipe",
  })
    .stdout.toString()
    .trim();

let pin = "";

beforeAll(() => {
  mkdirSync(join(INSTALL, "core/check"), { recursive: true });
  writeFileSync(join(INSTALL, "core/check/check-command.ts"), "export {};\n");
  git(["init", "-q"]);
  git(["add", "."]);
  git(["commit", "-q", "-m", "install"]);
  pin = git(["rev-parse", "HEAD"]);
});

afterAll(() => {
  rmSync(SANDBOX, { recursive: true, force: true });
});

const freshCheckout = (name: string): string => {
  const root = join(SANDBOX, name);
  mkdirSync(root, { recursive: true });
  return root;
};

describe("discipline-core toolchain", () => {
  test("links the pinned install into a checkout that has no .cache yet", () => {
    const root = freshCheckout("fresh");

    const ready = disciplineCore({ root, install: INSTALL, pin, runner: IDLE_RUNNER }).ready();

    expect(ready).toEqual({ ok: true, value: join(root, INSTALL_LINK) });
    expect(existsSync(join(root, INSTALL_LINK, "core/check/check-command.ts"))).toBe(true);
  });

  test("refuses an install at another commit and links nothing", () => {
    const root = freshCheckout("unpinned");

    const ready = disciplineCore({
      root,
      install: INSTALL,
      pin: "0000000000000000000000000000000000000000",
      runner: IDLE_RUNNER,
    }).ready();

    expect(ready).toMatchObject({ ok: false });
    expect(existsSync(join(root, INSTALL_LINK))).toBe(false);
  });

  test("names the missing install", () => {
    const root = freshCheckout("missing");
    const absent = join(SANDBOX, "absent");

    const ready = disciplineCore({ root, install: absent, pin, runner: IDLE_RUNNER }).ready();

    expect(ready).toMatchObject({ ok: false, problem: `no discipline-core install at ${absent}` });
  });
});

describe("installedCommit", () => {
  test("it reads the install's own commit, not the repository a git hook is running for", () => {
    const hookEnvironment = {
      PATH: process.env["PATH"],
      SystemRoot: process.env["SystemRoot"],
      GIT_DIR: join(SANDBOX, "another-repository", ".git"),
      GIT_INDEX_FILE: join(SANDBOX, "another-index"),
    };

    expect(installedCommit(INSTALL, hookEnvironment)).toBe(pin);
  });
});
