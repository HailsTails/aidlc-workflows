import { toolchainBoundStandaloneRunner } from "../../../core/mechanism-port/toolchain-bound-runner.ts";
import { createDefaultFileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../../../core/platform-ports/path-port.ts";
import { createWalkerRunner } from "./create-walker-runner.ts";
import { defaultTypeScriptModule, loadParsePort } from "./typescript-parse.ts";

export const runner = toolchainBoundStandaloneRunner({
  toolchain: loadParsePort({ typescript: defaultTypeScriptModule }),
  runnerOf: (parse) =>
    createWalkerRunner({
      fileText: createDefaultFileTextPort({}),
      modules: createDefaultModuleLoaderPort({}),
      path: createDefaultPathPort({}),
      parse,
    }),
});
