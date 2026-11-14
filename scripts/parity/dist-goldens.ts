import { fileURLToPath } from "node:url";
import { fileWorkspace } from "./adapters/file-workspace.ts";
import { goldenSource, goldenStore, type GoldenLayout } from "./adapters/golden-files.ts";
import { goldensCheck, updateGoldens, type GoldensDependencies } from "./application/goldens-check.ts";
import { discoveredHarnesses } from "./application/harness-discovery.ts";

const ROOT = fileURLToPath(new URL("../..", import.meta.url)).replace(/[\\/]$/, "");

const USAGE = [
  "usage: bun scripts/parity/dist-goldens.ts (--record | --check)",
  "  --record  hash every file under dist/ and dist-release/ and write tests/golden",
  "  --check   hash them again and compare with tests/golden",
  "Build the trees first: bun scripts/package.ts",
].join("\n");

type Mode = "record" | "check";

const workspace = fileWorkspace(ROOT);

const layout: GoldenLayout = {
  root: ROOT,
  outputRoots: ["dist", "dist-release"],
  harnesses: () => discoveredHarnesses(workspace),
  storeDirectory: "tests/golden",
};

const goldens: GoldensDependencies = {
  source: goldenSource(layout),
  store: goldenStore({ layout, workspace }),
};

const modeFrom = (argv: readonly string[]): Mode | undefined =>
  (["record", "check"] as const).find((name) => argv.includes(`--${name}`));

const check = (): number => {
  const report = goldensCheck(goldens);
  for (const finding of report.findings) {
    process.stderr.write(`- ${finding.subject}: ${finding.violation}\n`);
  }
  process.stdout.write(`dist goldens · ${report.note} · ${report.findings.length} findings\n`);
  return report.findings.length === 0 ? 0 : 1;
};

const record = (): number => {
  updateGoldens(goldens);
  process.stdout.write("dist goldens recorded in tests/golden\n");
  return 0;
};

const main = (): number => {
  const mode = modeFrom(Bun.argv.slice(2));
  if (mode === undefined) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  return mode === "record" ? record() : check();
};

process.exitCode = main();
