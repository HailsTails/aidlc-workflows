import { describe, expect, it } from "vitest";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const entrySource = import.meta.glob(["./check-command.ts"], {
  base: "./",
  query: "?raw",
  import: "default",
  eager: true,
});

const WIRING = `import { createDefaultFileTextPort } from "../platform-ports/file-text-port.ts";
import { createDefaultGitPort } from "../platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../platform-ports/path-port.ts";
import { createDefaultProcessPort } from "../platform-ports/process-port.ts";
import { runCheckCommand } from "./run-check-command.ts";

await runCheckCommand({
  process: createDefaultProcessPort({}),
  path: createDefaultPathPort({}),
  fileText: createDefaultFileTextPort({}),
  modules: createDefaultModuleLoaderPort({}),
  git: createDefaultGitPort({}),
  moduleUrl: import.meta.url,
});
`;

describe("check-command.ts, read as a build-time raw module (CD-47: the entry's own source is the assertion's subject; importing it would run the command, and nothing is spawned)", () => {
  it("only awaits runCheckCommand with the default port factories and its own module URL", () => {
    expect(entrySource).toEqual({ "./check-command.ts": WIRING });
  });
});
