import { toolchainBoundEmbeddedRunner } from "../../../core/mechanism-port/toolchain-bound-runner.ts";
import { createDefaultFileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import { installRootOfRunnerEntry } from "../../../core/platform-ports/package-location-port.ts";
import { createDefaultPathPort } from "../../../core/platform-ports/path-port.ts";
import { moduleExtensionOf } from "../../../core/values/install-layout.ts";
import { createEslintRunner, ESLINT_PROJECTED_KINDS } from "./create-eslint-runner.ts";
import { createEslintPort } from "./eslint-instance.ts";
import { defaultEslintToolchainPeers, loadEslintToolchain } from "./eslint-toolchain.ts";

export const runner = toolchainBoundEmbeddedRunner({
  toolchain: loadEslintToolchain({
    peers: defaultEslintToolchainPeers({ installRoot: installRootOfRunnerEntry({ entryFile: import.meta.filename }) }),
  }),
  projectedKinds: ESLINT_PROJECTED_KINDS,
  runnerOf: (toolchain) =>
    createEslintRunner({
      fileText: createDefaultFileTextPort({}),
      modules: createDefaultModuleLoaderPort({}),
      path: createDefaultPathPort({}),
      eslint: createEslintPort({ toolchain }),
      moduleExtension: moduleExtensionOf({ moduleUrl: import.meta.url }),
    }),
});
