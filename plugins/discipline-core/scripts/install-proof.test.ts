import { describe, expect, it } from "vitest";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const entrySource = import.meta.glob(["./install-proof.ts"], {
  base: "./",
  query: "?raw",
  import: "default",
  eager: true,
});

const WIRING = `import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import { createDefaultProcessPort } from "../core/platform-ports/process-port.ts";
import { PROOF_CASES } from "./install-proof-plan.ts";
import { createDefaultCommandRunPort, createDefaultScratchFilesPort } from "./install-proof-ports.ts";
import { runInstallProof } from "./run-install-proof.ts";

await runInstallProof({
  process: createDefaultProcessPort({}),
  path: createDefaultPathPort({}),
  fileText: createDefaultFileTextPort({}),
  scratch: createDefaultScratchFilesPort({}),
  commands: createDefaultCommandRunPort({}),
  moduleUrl: import.meta.url,
  proofCases: PROOF_CASES,
});
`;

describe("install-proof.ts, read as a build-time raw module (CD-47: the entry's own source is the assertion's subject; importing it would run the proof, and nothing is spawned)", () => {
  it("only awaits runInstallProof with the default port factories, its own module URL and the plan's proof cases", () => {
    expect(entrySource).toEqual({ "./install-proof.ts": WIRING });
  });
});
