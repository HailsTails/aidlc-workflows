// rin-harness-sensor-format.ts — per-sensor script for the `format` sensor.
//
// Formatting has exactly one correct answer, so REPORTING it is the wrong
// contract: a finding the author can only resolve by running the formatter buys
// a round trip and changes nothing about the code's meaning. This sensor applies
// the format to the file that was just written and reports what it changed.
//
// Why this exists alongside the shipped `linter` sensor: that one wraps eslint,
// which this project does not use, so it exits 127 and passes quietly. Biome is
// the configured formatter here.
//
// Exit codes follow the per-sensor script contract:
//   0   pass (the JSON `pass` field carries the verdict)
//   127 biome unresolvable — the dispatcher reclassifies as tool-unavailable
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const FORMATTED_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs|json|jsonc|css)$/;

const TOOL_UNAVAILABLE_EXIT_CODE = 127;

const argumentValue = ({
  argv,
  flag,
}: {
  readonly argv: readonly string[];
  readonly flag: string;
}): string | null => {
  const index = argv.indexOf(flag);
  return index === -1 || index + 1 >= argv.length
    ? null
    : (argv[index + 1] ?? null);
};

// The dispatcher decides which flag a sensor gets from a CLOSED literal in core
// (`isCodeSensor = id === "linter" || id === "type-check"` in aidlc-sensor.ts),
// so a plugin-contributed sensor can never be classified as a code sensor and
// always receives --output-path. Accepting both is what stops this sensor
// silently no-opping on every fire — reporting a clean pass for a file it never
// opened. rin's per-CD sensors resolve the same way.
const targetPathFrom = ({
  argv,
}: {
  readonly argv: readonly string[];
}): string | null =>
  argumentValue({ argv, flag: "--file-path" }) ??
  argumentValue({ argv, flag: "--output-path" });

const nearestProjectRoot = (startPath: string): string => {
  const walkUp = (directory: string): string => {
    if (existsSync(resolve(directory, "package.json"))) return directory;
    const parent = dirname(directory);
    return parent === directory ? directory : walkUp(parent);
  };
  return walkUp(dirname(resolve(startPath)));
};

const emit = (payload: {
  pass: boolean;
  reformatted: boolean;
  file: string;
  note?: string;
}): void => {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
};

const runFormatSensor = (): void => {
  // The dispatcher decides which flag to pass from a CLOSED allowlist of sensor
  const filePath = targetPathFrom({ argv: process.argv });
  if (filePath === null || !existsSync(filePath)) {
    emit({
      pass: true,
      reformatted: false,
      file: filePath ?? "",
      note: "no such file",
    });
    return;
  }

  if (!FORMATTED_EXTENSIONS.test(filePath)) {
    emit({
      pass: true,
      reformatted: false,
      file: filePath,
      note: "not a formatted type",
    });
    return;
  }

  const projectRoot = nearestProjectRoot(filePath);
  const before = readFileSync(filePath, "utf-8");

  const formatted = spawnSync(
    "bunx",
    ["biome", "format", "--write", "--no-errors-on-unmatched", filePath],
    { cwd: projectRoot, encoding: "utf-8" },
  );

  if (formatted.error !== undefined) {
    process.stderr.write("biome-unavailable\n");
    process.exit(TOOL_UNAVAILABLE_EXIT_CODE);
  }

  const after = readFileSync(filePath, "utf-8");
  emit({ pass: true, reformatted: before !== after, file: filePath });
};

if (import.meta.main) runFormatSensor();

export { FORMATTED_EXTENSIONS, nearestProjectRoot, targetPathFrom };
