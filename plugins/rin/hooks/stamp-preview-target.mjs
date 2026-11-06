import { lstatSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { previewRuntimeContract, previewRegistrationDisposition, previewFailure } from "./preview-runtime-contract.mjs";

const repoRootFrom = ({ directory }) => {
  const parent = dirname(directory);
  if (parent === directory) return null;
  return lstatSync(join(directory, "scripts"), { throwIfNoEntry: false })?.isDirectory()
    ? directory
    : repoRootFrom({ directory: parent });
};

const loadPreviewRuntime = async ({ hookDirectory }) => {
  try {
    const repoRoot = repoRootFrom({ directory: hookDirectory });
    if (repoRoot === null) return previewFailure({ reason: "missing-runtime" });
    const generatorPath = join(repoRoot, "scripts", "generate-preview-launch.mjs");
    const registryPath = join(repoRoot, "scripts", "preview-worktree-registry.mjs");
    if (!statSync(generatorPath, { throwIfNoEntry: false })?.isFile() || !statSync(registryPath, { throwIfNoEntry: false })?.isFile()) {
      return previewFailure({ reason: "missing-runtime" });
    }
    const generator = await import(pathToFileURL(generatorPath).href);
    const registry = await import(pathToFileURL(registryPath).href);
    return previewRuntimeContract({ generator, registry });
  } catch {
    return previewFailure({ reason: "load-failed" });
  }
};

const isWorktreeRoot = ({ directory }) => {
  try {
    return lstatSync(join(directory, ".git")).isFile();
  } catch {
    return false;
  }
};

const targetDirectoryFrom = ({ invocation, sessionDirectory }) => {
  const fromToolInput = invocation?.tool_input?.path;
  if (typeof fromToolInput === "string" && isWorktreeRoot({ directory: fromToolInput })) {
    return fromToolInput;
  }
  return isWorktreeRoot({ directory: sessionDirectory }) ? sessionDirectory : null;
};

const registerWorktree = async ({ worktreeDirectory, hookDirectory }) => {
  const loaded = await loadPreviewRuntime({ hookDirectory });
  if (loaded.kind !== "ready") return loaded;
  try {
    const { generatePreviewLaunch, mainRootFrom, prunedWorktrees, readRegistry, writeRegistry } = loaded.runtime;
    const mainRoot = mainRootFrom({ anyRepoDirectory: worktreeDirectory });
    const registry = readRegistry({ mainRoot });
    const live = prunedWorktrees({ worktrees: registry.worktrees });
    const worktrees = { ...live, [basename(worktreeDirectory)]: { path: worktreeDirectory } };
    writeRegistry({ mainRoot, registry: { worktrees } });
    await generatePreviewLaunch({ anyRepoDirectory: worktreeDirectory });
    return { kind: "registered" };
  } catch {
    return previewFailure({ reason: "execution-failed" });
  }
};

const invocationFrom = ({ raw }) => {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const main = async ({ processPort }) => {
  const input = await processPort.readInput();
  if (input.kind !== "read") return input;
  const worktreeDirectory = targetDirectoryFrom({ invocation: invocationFrom({ raw: input.raw }), sessionDirectory: processPort.sessionDirectory });
  return worktreeDirectory === null
    ? { kind: "not-requested" }
    : registerWorktree({ worktreeDirectory, hookDirectory: processPort.hookDirectory });
};

const createPreviewHookProcess = () => ({
  sessionDirectory: process.cwd(),
  hookDirectory: dirname(fileURLToPath(import.meta.url)),
  readInput: () => new Promise((resolve) => {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { raw += chunk; });
    process.stdin.on("end", () => resolve({ kind: "read", raw }));
    process.stdin.on("error", () => resolve(previewFailure({ reason: "input-failed" })));
  }),
  finish: ({ outcome }) => {
    const { exitCode, diagnostic } = previewRegistrationDisposition({ outcome });
    process.stderr.write(diagnostic);
    process.exitCode = exitCode;
  },
});

const processPort = createPreviewHookProcess();
main({ processPort }).then(
  (outcome) => processPort.finish({ outcome }),
  () => processPort.finish({ outcome: previewFailure({ reason: "unexpected" }) }),
);

