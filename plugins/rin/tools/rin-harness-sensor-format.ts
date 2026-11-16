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
//   127 biome not installed in the project — the dispatcher reclassifies as tool-unavailable
import { defaultReviewProcessPort } from "./rin-gates/review-process-port.ts";
import { defaultPathOperations } from "./rin-harness-path-operations.ts";
import { defaultFileTextPort } from "./rin-harness-sidecar-file-reader.ts";

const FORMATTED_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs|json|jsonc|css)$/;

const TOOL_UNAVAILABLE_EXIT_CODE = 127;

const paths = defaultPathOperations();
const files = defaultFileTextPort();

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
    if (files.exists(paths.join({ segments: [directory, "package.json"] })))
      return directory;
    const parent = paths.dirname({ path: directory });
    return parent === directory ? directory : walkUp(parent);
  };
  return walkUp(
    paths.dirname({ path: paths.resolve({ segments: [startPath] }) }),
  );
};

type InstalledTool = {
  readonly version: string;
  readonly cliPath: string;
};

type ProjectToolRequest = {
  readonly projectRoot: string;
  readonly packageName: string;
  readonly binName: string;
};

type FormatCommand =
  | {
      readonly kind: "run";
      readonly executable: string;
      readonly commandArguments: readonly string[];
    }
  | { readonly kind: "unavailable"; readonly message: string };

const BIOME_PACKAGE = "@biomejs/biome";

const isRecord = (candidate: unknown): candidate is Record<string, unknown> =>
  typeof candidate === "object" &&
  candidate !== null &&
  !Array.isArray(candidate);

const ancestorDirectories = (start: string): readonly string[] => {
  const parent = paths.dirname({ path: start });
  return parent === start ? [start] : [start, ...ancestorDirectories(parent)];
};

const parsedManifest = (
  manifestPath: string,
): Record<string, unknown> | null => {
  try {
    const manifest: unknown = JSON.parse(files.read(manifestPath));
    return isRecord(manifest) ? manifest : null;
  } catch {
    return null;
  }
};

const binRelativePath = ({
  manifest,
  binName,
}: {
  readonly manifest: Record<string, unknown>;
  readonly binName: string;
}): string | null => {
  const { bin } = manifest;
  if (typeof bin === "string") return bin;
  if (!isRecord(bin)) return null;
  const entry = bin[binName];
  return typeof entry === "string" ? entry : null;
};

const toolInstalledAt = ({
  packageDirectory,
  request,
}: {
  readonly packageDirectory: string;
  readonly request: ProjectToolRequest;
}): InstalledTool | null => {
  const manifest = parsedManifest(
    paths.join({ segments: [packageDirectory, "package.json"] }),
  );
  if (
    manifest === null ||
    manifest["name"] !== request.packageName ||
    typeof manifest["version"] !== "string"
  )
    return null;
  const relativeCli = binRelativePath({ manifest, binName: request.binName });
  if (relativeCli === null) return null;
  const cliPath = paths.join({ segments: [packageDirectory, relativeCli] });
  return files.exists(cliPath)
    ? { version: manifest["version"], cliPath }
    : null;
};

const installedProjectTool = (
  request: ProjectToolRequest,
): InstalledTool | null => {
  const packageDirectory = ancestorDirectories(
    paths.resolve({ segments: [request.projectRoot] }),
  )
    .map((directory) =>
      paths.join({
        segments: [directory, "node_modules", request.packageName],
      }),
    )
    .find((candidate) =>
      files.exists(paths.join({ segments: [candidate, "package.json"] })),
    );
  return packageDirectory === undefined
    ? null
    : toolInstalledAt({ packageDirectory, request });
};

const biomeFormatCommand = ({
  filePath,
  projectRoot,
  resolveTool,
}: {
  readonly filePath: string;
  readonly projectRoot: string;
  readonly resolveTool: (request: ProjectToolRequest) => InstalledTool | null;
}): FormatCommand => {
  const biome = resolveTool({
    projectRoot,
    packageName: BIOME_PACKAGE,
    binName: "biome",
  });
  if (biome === null)
    return {
      kind: "unavailable",
      message: `biome-unavailable: ${BIOME_PACKAGE} is not installed in ${projectRoot} or its parent directories; install ${BIOME_PACKAGE} as a devDependency of this repository to enable this sensor`,
    };
  return {
    kind: "run",
    executable: process.execPath,
    commandArguments: [
      biome.cliPath,
      "format",
      "--write",
      "--no-errors-on-unmatched",
      filePath,
    ],
  };
};

const runFormatSensor = (): void => {
  const processes = defaultReviewProcessPort();
  const emit = (payload: {
    pass: boolean;
    reformatted: boolean;
    file: string;
    note?: string;
  }): void => {
    processes.publish(`${JSON.stringify(payload)}\n`);
  };
  const unavailable: (message: string) => never = (message) => {
    processes.diagnose(`${message}\n`);
    return processes.exit(TOOL_UNAVAILABLE_EXIT_CODE);
  };

  const filePath = targetPathFrom({ argv: processes.arguments });
  if (filePath === null || !files.exists(filePath)) {
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
  const command = biomeFormatCommand({
    filePath,
    projectRoot,
    resolveTool: installedProjectTool,
  });
  if (command.kind === "unavailable") unavailable(command.message);

  const before = files.read(filePath);
  const formatted = processes.runSync({
    program: command.executable,
    args: command.commandArguments,
    cwd: projectRoot,
    environment: processes.environment,
  });
  if (formatted.status === null) unavailable("biome-unavailable");

  const after = files.read(filePath);
  emit({ pass: true, reformatted: before !== after, file: filePath });
};

if (import.meta.main) runFormatSensor();

export {
  biomeFormatCommand,
  FORMATTED_EXTENSIONS,
  installedProjectTool,
  nearestProjectRoot,
  targetPathFrom,
};
