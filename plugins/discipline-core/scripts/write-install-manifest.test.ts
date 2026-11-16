import { describe, expect, it } from "vitest";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const entrySource = import.meta.glob(["./write-install-manifest.ts"], {
  base: "./",
  query: "?raw",
  import: "default",
  eager: true,
});

const WIRING = `import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import { createDefaultProcessPort } from "../core/platform-ports/process-port.ts";
import { runWriteInstallManifest } from "./install-manifest.ts";

runWriteInstallManifest({
  process: createDefaultProcessPort({}),
  path: createDefaultPathPort({}),
  fileText: createDefaultFileTextPort({}),
  moduleUrl: import.meta.url,
});
`;

describe("write-install-manifest.ts, read as a build-time raw module (CD-47: the entry's own source is the assertion's subject; importing it would write the manifest)", () => {
  it("only calls runWriteInstallManifest with the default port factories and its own module URL", () => {
    expect(entrySource).toEqual({ "./write-install-manifest.ts": WIRING });
  });
});
