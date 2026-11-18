// covers: harness-instrument:e2e-temporary-root
//
// Where the runner puts each test file's fixtures. On Windows they sit under
// the shorter of the runner's TEMP and the system's temp folder, so a test
// project is as deep as a person's; a live Codex leg keeps the runner's own
// TEMP, because Codex's Windows sandbox refuses AI-DLC's writes under
// %SystemRoot%. Each case reads the pick from a fresh runner process, since
// the helper keeps its first answer. Off Windows both cases hold as they did.

import { afterAll, expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, realpathSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { NATIVE_FIXTURE_SETUP_TIMEOUT_MS, NATIVE_STARTUP_TIMEOUT_MS } from "../harness/test-budget.ts";
import { createE2eTemporaryRoot } from "../lib/e2e-workers.ts";

setDefaultTimeout(NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

const WORKERS = pathToFileURL(join(import.meta.dir, "..", "lib", "e2e-workers.ts")).href;
const made: string[] = [];

afterAll(() => {
  for (const path of made.reverse()) rmSync(path, { recursive: true, force: true });
});

// A runner TEMP deeper than %SystemRoot%\Temp, outside any Git marker.
async function runnerTemp(): Promise<string> {
  const base = await createE2eTemporaryRoot();
  made.push(base);
  const temp = join(base, "a-runner-temp-deeper-than-the-system-one");
  mkdirSync(temp);
  return realpathSync(temp);
}

// The fixture root a fresh runner process makes with this TEMP.
function fixtureRoot(temp: string, codexLive: boolean): string {
  const env: NodeJS.ProcessEnv = { ...process.env, TEMP: temp, TMP: temp, TMPDIR: temp };
  if (codexLive) env.AIDLC_CODEX_EXEC_LIVE = "1";
  else delete env.AIDLC_CODEX_EXEC_LIVE;
  const script = "const { createE2eTemporaryRoot } = await import(process.argv[1]);" +
    "console.log(await createE2eTemporaryRoot());";
  const child = spawnSync(process.execPath, ["-e", script, WORKERS], {
    env, encoding: "utf8", timeout: NATIVE_STARTUP_TIMEOUT_MS,
  });
  expect(child.status, `${child.stdout}${child.stderr}`).toBe(0);
  const root = child.stdout.trim();
  made.push(root);
  return realpathSync(root);
}

test("a live Codex leg's fixtures stay in the runner's own temp folder, never the system one", async () => {
  const temp = await runnerTemp();
  expect(dirname(fixtureRoot(temp, true))).toBe(temp);
});

test("every other file still gets the shorter temp folder", async () => {
  const temp = await runnerTemp();
  expect(dirname(fixtureRoot(temp, false)).length).toBeLessThanOrEqual(temp.length);
});

test("an explicit root contains the descendant fixture and its cache", async () => {
  const base = await createE2eTemporaryRoot([process.env.TEMP!]);
  made.push(base);
  const root = join(base, "explicit-root-deeper-than-the-system-temp");
  mkdirSync(root);
  const script = `
    const { shortTemporaryRoot, createE2eTemporaryRoot } = await import(process.argv[1]);
    const { realpathSync } = await import("node:fs");
    if (shortTemporaryRoot() !== realpathSync(process.env.AIDLC_TEST_TEMP_ROOT)) {
      throw Error("explicit root ignored");
    }
    const fixture = await createE2eTemporaryRoot();
    const descendant = Bun.spawnSync([process.execPath, "-e", \`
      const { tmpdir } = require("node:os");
      const { join } = require("node:path");
      const { mkdirSync, writeFileSync } = require("node:fs");
      const cache = join(tmpdir(), "aidlc-release-fixture-cache");
      mkdirSync(cache); writeFileSync(join(cache, "probe"), "fixture cache");
      console.log(JSON.stringify({fixture: tmpdir(), cache}));
    \` ], {env: {...process.env, TEMP: fixture, TMP: fixture, TMPDIR: fixture}});
    if (descendant.exitCode !== 0) throw Error(descendant.stderr.toString());
    console.log(descendant.stdout.toString());
  `;
  const child = spawnSync(process.execPath, ["-e", script, WORKERS], {
    env: {...process.env, AIDLC_TEST_TEMP_ROOT: root},
    encoding: "utf8", timeout: NATIVE_STARTUP_TIMEOUT_MS,
  });
  expect(child.status, `${child.stdout}${child.stderr}`).toBe(0);
  const paths = JSON.parse(child.stdout);
  expect(dirname(paths.fixture)).toBe(realpathSync(root));
  expect(dirname(paths.cache)).toBe(paths.fixture);
});

test("an unavailable explicit root refuses instead of choosing an OS fallback", async () => {
  const base = await createE2eTemporaryRoot([process.env.TEMP!]);
  made.push(base);
  const missing = join(base, "missing");
  const child = spawnSync(process.execPath, ["-e",
    'const { createE2eTemporaryRoot } = await import(process.argv[1]);' +
      'console.log(await createE2eTemporaryRoot());', WORKERS], {
    env: {...process.env, AIDLC_TEST_TEMP_ROOT: missing},
    encoding: "utf8", timeout: NATIVE_STARTUP_TIMEOUT_MS,
  });
  expect(child.status).not.toBe(0);
  expect(child.stderr).toContain("AIDLC_TEST_TEMP_ROOT");
});
