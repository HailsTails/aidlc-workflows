import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import { createDefaultProcessPort } from "../core/platform-ports/process-port.ts";
import { createEsbuildBundlerPort } from "./esbuild-bundler-port.ts";
import { PROOF_CASES } from "./install-proof-plan.ts";
import { createDefaultCommandRunPort, createDefaultScratchFilesPort } from "./install-proof-ports.ts";
import { createTarballPacker } from "./package-commands.ts";
import { runInstallProof } from "./run-install-proof.ts";

await runInstallProof({
  process: createDefaultProcessPort({}),
  path: createDefaultPathPort({}),
  fileText: createDefaultFileTextPort({}),
  scratch: createDefaultScratchFilesPort({}),
  commands: createDefaultCommandRunPort({}),
  packer: createTarballPacker({
    ports: {
      path: createDefaultPathPort({}),
      fileText: createDefaultFileTextPort({}),
      scratch: createDefaultScratchFilesPort({}),
      bundler: createEsbuildBundlerPort({}),
    },
    commands: createDefaultCommandRunPort({}),
  }),
  moduleUrl: import.meta.url,
  proofCases: PROOF_CASES,
});
