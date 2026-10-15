import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { GitPort } from "../platform-ports/git-port.ts";
import type { ModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import type { ProcessPort } from "../platform-ports/process-port.ts";
import { type AbsolutePath, absolutePathSchema } from "../values/absolute-path.ts";
import type { Result } from "../values/result.ts";
import type { CheckReport } from "../verdict/check-report.ts";
import { parseCheckArguments } from "./command-arguments-schema.ts";
import { type CommandOutcome, checkCommandOutcome } from "./command-outcome.ts";
import { installRootOf } from "./install-root.ts";
import type { LoadFailure } from "./load-failure.ts";
import { runCheck } from "./run-check.ts";

export type CommandRequest = {
  readonly process: ProcessPort;
  readonly path: PathPort;
  readonly fileText: FileTextPort;
  readonly modules: ModuleLoaderPort;
  readonly git: GitPort;
  readonly moduleUrl: string;
};

export const repoRootOf = (request: {
  readonly path: PathPort;
  readonly repo: string;
}): Result<AbsolutePath, LoadFailure> => {
  const parsed = absolutePathSchema.safeParse(request.path.resolve({ path: request.repo }));
  if (!parsed.success) {
    return {
      outcome: "failed",
      error: { kind: "arguments-invalid", detail: `--repo ${request.repo} resolves to no absolute path` },
    };
  }
  return { outcome: "ok", value: parsed.data };
};

export const printOutcome = (request: {
  readonly process: ProcessPort;
  readonly outcome: CommandOutcome;
}): void => {
  request.process.writeOut({ text: request.outcome.text });
  request.process.exitWith({ code: request.outcome.code });
};

const checkResult = (request: CommandRequest): Promise<Result<CheckReport, LoadFailure>> => {
  const parsed = parseCheckArguments({ arguments: request.process.arguments });
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
  return runCheck({
    repoRoot: repoRoot.value,
    installRoot: installRoot.value,
    baseRevision: parsed.value.baseRevision,
    fileText: request.fileText,
    modules: request.modules,
    path: request.path,
    git: request.git,
  });
};

export const runCheckCommand = (request: CommandRequest): Promise<void> =>
  checkResult(request).then((checked) =>
    printOutcome({ process: request.process, outcome: checkCommandOutcome({ result: checked }) }),
  );
