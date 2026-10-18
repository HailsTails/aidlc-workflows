import { createDefaultFileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../../../core/platform-ports/path-port.ts";
import { createEslintRunner } from "./create-eslint-runner.ts";
import { createDefaultEslintPort } from "./eslint-instance.ts";

export const runner = createEslintRunner({
  fileText: createDefaultFileTextPort({}),
  modules: createDefaultModuleLoaderPort({}),
  path: createDefaultPathPort({}),
  eslint: createDefaultEslintPort({}),
});
