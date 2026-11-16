import { toolchainBoundEmbeddedRunner } from "../../../core/mechanism-port/toolchain-bound-runner.ts";
import { createDefaultFileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../../../core/platform-ports/path-port.ts";
import { createEslintRunner, ESLINT_PROJECTED_KINDS } from "./create-eslint-runner.ts";
import { createEslintPort } from "./eslint-instance.ts";
import { defaultEslintToolchainModules, loadEslintToolchain } from "./eslint-toolchain.ts";

export const runner = toolchainBoundEmbeddedRunner({
  toolchain: loadEslintToolchain({ modules: defaultEslintToolchainModules }),
  projectedKinds: ESLINT_PROJECTED_KINDS,
  runnerOf: (toolchain) =>
    createEslintRunner({
      fileText: createDefaultFileTextPort({}),
      modules: createDefaultModuleLoaderPort({}),
      path: createDefaultPathPort({}),
      eslint: createEslintPort({ toolchain }),
    }),
});
