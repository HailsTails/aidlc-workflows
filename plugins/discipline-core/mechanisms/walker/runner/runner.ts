import { createDefaultDirectoryPort } from "../../../core/platform-ports/file-system-port.ts";
import { createDefaultFileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../../../core/platform-ports/path-port.ts";
import { createWalkerRunner } from "./create-walker-runner.ts";
import { createDefaultParsePort } from "./typescript-parse.ts";

export const runner = createWalkerRunner({
  directory: createDefaultDirectoryPort({}),
  fileText: createDefaultFileTextPort({}),
  modules: createDefaultModuleLoaderPort({}),
  path: createDefaultPathPort({}),
  parse: createDefaultParsePort({}),
});
