import { describe, expect, it } from "vitest";
import { syntaxErrorsOn } from "./typescript-parse-port.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const shippedSources = import.meta.glob(
  ["./core/**/*.ts", "./mechanisms/**/*.ts", "!./**/*.test.ts", "!./**/test-fixtures/**"],
  { base: "../", query: "?raw", import: "default", eager: true },
);

describe("core's shipped source under the oldest supported TypeScript, read as build-time raw modules (CD-47: the shipped source is the assertion's subject; nothing is spawned or written)", () => {
  it("reads a known file, so the scanned set is not silently empty", () => {
    expect(shippedSources).toEqual(expect.objectContaining({ "./mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts": expect.any(String) }));
  });

  it("parses every shipped file without a syntax error, since a repository whose ESLint lints the install parses it with its own TypeScript", async () => {
    expect(await syntaxErrorsOn({ line: "typescript-floor", sources: shippedSources })).toEqual([]);
  });
});
