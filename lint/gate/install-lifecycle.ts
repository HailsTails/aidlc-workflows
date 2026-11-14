import { rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { copyInstallLab } from "./adapters/copy-install-lab.ts";
import { fileWorkspace } from "./adapters/file-workspace.ts";
import { lifecycleFixtures } from "./adapters/lifecycle-fixtures.ts";
import { checkLifecycles, recordLifecycles } from "./application/install-lifecycle.ts";
import { discoveredHarnesses } from "./application/harness-discovery.ts";

const ROOT = fileURLToPath(new URL("../..", import.meta.url)).replace(/[\\/]$/, "");
const SANDBOX = join(ROOT, ".cache", "install-lab");

const USAGE = [
  "usage: bun lint/gate/install-lifecycle.ts (--record | --check) --previous <dist root>",
  "  --record    install every harness through the real CLI and write tests/golden/install",
  "  --check     install every harness again and compare it with the recorded lifecycle",
  "  --previous  the dist folder built from the previous release (or AIDLC_PREVIOUS_DIST)",
  "Run it under the machine lock:",
  "  bun scripts/gate.ts --locked -- bun lint/gate/install-lifecycle.ts …",
].join("\n");

type Mode = "record" | "check";

type Request = { readonly mode: Mode; readonly previous: string };

const requestFrom = (argv: readonly string[]): Request | undefined => {
  const mode = (["record", "check"] as const).find((name) => argv.includes(`--${name}`));
  const flagged = argv[argv.indexOf("--previous") + 1];
  const previous = argv.includes("--previous") ? flagged : process.env["AIDLC_PREVIOUS_DIST"];
  return mode === undefined || previous === undefined ? undefined : { mode, previous };
};

const workspace = fileWorkspace(ROOT);

const harnesses = (): readonly string[] => discoveredHarnesses(workspace);

const main = (): number => {
  const request = requestFrom(Bun.argv.slice(2));
  if (request === undefined) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  rmSync(SANDBOX, { recursive: true, force: true });
  const lab = copyInstallLab({
    sandbox: SANDBOX,
    runtimes: { current: join(ROOT, "dist"), previous: request.previous },
    searchPath: process.env["PATH"] ?? "",
    systemRoot: process.env["SystemRoot"] ?? "",
  });
  const fixtures = lifecycleFixtures({
    layout: { directory: "tests/golden/install", harnesses },
    workspace,
  });
  if (request.mode === "record") {
    for (const harness of recordLifecycles(lab, fixtures)) {
      process.stdout.write(`recorded ${harness}\n`);
    }
    return 0;
  }
  const findings = checkLifecycles(lab, fixtures);
  for (const finding of findings) {
    process.stderr.write(`- ${finding.subject}: ${finding.violation}\n`);
  }
  process.stdout.write(`install lifecycle · ${findings.length} findings\n`);
  return findings.length === 0 ? 0 : 1;
};

process.exitCode = main();
