import { createDefaultFileTextPort } from "../platform-ports/file-text-port.ts";
import { createDefaultGitPort } from "../platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../platform-ports/path-port.ts";
import { createDefaultProcessPort } from "../platform-ports/process-port.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { Result } from "../values/result.ts";
import type { CheckReport } from "../verdict/check-report.ts";
import { parseCheckArguments } from "./command-arguments-schema.ts";
import { checkCommandOutcome } from "./command-outcome.ts";
import type { LoadFailure } from "./load-failure.ts";
import { runCheck } from "./run-check.ts";

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

const checkResult = async (): Promise<Result<CheckReport, LoadFailure>> => {
  const parsed = parseCheckArguments({ arguments: processPort.arguments });
  if (parsed.outcome === "failed") {
    return parsed;
  }
  const install = installRoot();
  if (install.outcome === "failed") {
    return install;
  }
  return runCheck({
    repoRoot: path.resolve({ path: parsed.value.repo }),
    installRoot: install.value,
    baseRevision: parsed.value.baseRevision,
    fileText: createDefaultFileTextPort({}),
    modules: createDefaultModuleLoaderPort({}),
    path,
    git: createDefaultGitPort({}),
  });
};

await checkResult().then((checkReport) => {
  const outcome = checkCommandOutcome({ result: checkReport });
  processPort.writeOut({ text: outcome.text });
  processPort.exitWith({ code: outcome.code });
});
