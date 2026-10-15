import { createDefaultFileTextPort } from "../platform-ports/file-text-port.ts";
import { createDefaultGitPort } from "../platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../platform-ports/path-port.ts";
import { createDefaultProcessPort } from "../platform-ports/process-port.ts";
import { runProjectCommand } from "./run-project-command.ts";

await runProjectCommand({
  process: createDefaultProcessPort({}),
  path: createDefaultPathPort({}),
  fileText: createDefaultFileTextPort({}),
  modules: createDefaultModuleLoaderPort({}),
  git: createDefaultGitPort({}),
  moduleUrl: import.meta.url,
});
