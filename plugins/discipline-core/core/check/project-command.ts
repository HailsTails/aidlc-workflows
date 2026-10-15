import { createDefaultFileTextPort } from "../platform-ports/file-text-port.ts";
import { createDefaultGitPort } from "../platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../platform-ports/path-port.ts";
import { createDefaultProcessPort } from "../platform-ports/process-port.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { Result } from "../values/result.ts";
import type { ProjectionWrite } from "../mechanism-port/runner-result-schema.ts";
import { parseProjectArguments } from "./command-arguments-schema.ts";
import { projectCommandOutcome } from "./command-outcome.ts";
import type { LoadFailure } from "./load-failure.ts";
import { runProject } from "./run-project.ts";

const processPort = createDefaultProcessPort({});
const path = createDefaultPathPort({});

const installRoot = (): Result<AbsolutePath, LoadFailure> => {
  const entry = path.fromFileUrl({ url: import.meta.url });
  if (entry.outcome === "failed") {
    return { outcome: "failed", error: { kind: "install-root-unresolvable", url: entry.error.url, detail: entry.error.detail } };
  }
  return {
    outcome: "ok",
    value: path.resolve({
      path: path.directoryOf({ path: path.directoryOf({ path: path.directoryOf({ path: entry.value }) }) }),
    }),
  };
};

const projectResult = async (): Promise<Result<readonly ProjectionWrite[], LoadFailure>> => {
  const parsed = parseProjectArguments({ arguments: processPort.arguments });
  if (parsed.outcome === "failed") {
    return parsed;
  }
  const install = installRoot();
  if (install.outcome === "failed") {
    return install;
  }
  return runProject({
    repoRoot: path.resolve({ path: parsed.value.repo }),
    installRoot: install.value,
    fileText: createDefaultFileTextPort({}),
    modules: createDefaultModuleLoaderPort({}),
    path,
    git: createDefaultGitPort({}),
  });
};

await projectResult().then((projectionWrites) => {
  const outcome = projectCommandOutcome({ result: projectionWrites });
  processPort.writeOut({ text: outcome.text });
  processPort.exitWith({ code: outcome.code });
});
