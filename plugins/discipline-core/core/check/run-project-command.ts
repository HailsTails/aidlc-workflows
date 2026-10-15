import type { ProjectionWrite } from "../mechanism-port/runner-result-schema.ts";
import type { Result } from "../values/result.ts";
import { parseProjectArguments } from "./command-arguments-schema.ts";
import { projectCommandOutcome } from "./command-outcome.ts";
import { installRootOf } from "./install-root.ts";
import type { LoadFailure } from "./load-failure.ts";
import { type CommandRequest, printOutcome, repoRootOf } from "./run-check-command.ts";
import { runProject } from "./run-project.ts";

const projectResult = (request: CommandRequest): Promise<Result<readonly ProjectionWrite[], LoadFailure>> => {
  const parsed = parseProjectArguments({ arguments: request.process.arguments });
  if (parsed.outcome === "failed") {
    return Promise.resolve(parsed);
  }
  const repoRoot = repoRootOf({ path: request.path, repo: parsed.value.repo });
  if (repoRoot.outcome === "failed") {
    return Promise.resolve(repoRoot);
  }
  const installRoot = installRootOf({ path: request.path, moduleUrl: request.moduleUrl });
  if (installRoot.outcome === "failed") {
    return Promise.resolve(installRoot);
  }
  return runProject({
    repoRoot: repoRoot.value,
    installRoot: installRoot.value,
    fileText: request.fileText,
    modules: request.modules,
    path: request.path,
    git: request.git,
  });
};

export const runProjectCommand = (request: CommandRequest): Promise<void> =>
  projectResult(request).then((projected) =>
    printOutcome({ process: request.process, outcome: projectCommandOutcome({ result: projected }) }),
  );
