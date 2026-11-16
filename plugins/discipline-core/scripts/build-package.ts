import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import { createDefaultProcessPort } from "../core/platform-ports/process-port.ts";
import { createEsbuildBundlerPort } from "./esbuild-bundler-port.ts";
import { createDefaultCommandRunPort, createDefaultScratchFilesPort } from "./install-proof-ports.ts";
import { runBuildPackage } from "./package-commands.ts";

await runBuildPackage({
  process: createDefaultProcessPort({}),
  path: createDefaultPathPort({}),
  fileText: createDefaultFileTextPort({}),
  scratch: createDefaultScratchFilesPort({}),
  bundler: createEsbuildBundlerPort({}),
  commands: createDefaultCommandRunPort({}),
  moduleUrl: import.meta.url,
});
