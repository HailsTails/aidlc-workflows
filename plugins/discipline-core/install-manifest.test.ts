import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parsedJson } from "./core/rule-set-reader/rule-set-reader.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const installFiles = import.meta.glob(["./package.json", "./README.md"], {
  base: "./",
  query: "?raw",
  import: "default",
  eager: true,
});

const declaresModuleType = z
  .string()
  .transform((text) => parsedJson({ text }))
  .pipe(z.object({ outcome: z.literal("ok"), value: z.object({ type: z.literal("module") }).loose() }));

const INSTALL_LIST_NAMES_PACKAGE_JSON = /^Fetch these paths[^\n]*:\n\n(?:- [^\n]*\n)*?- always: [^\n]*`package\.json`/m;

describe("the install's own module type, read as build-time raw files (CD-47: this package's manifest and README are the assertion's subject and no fake can stand in for them; nothing is spawned or written)", () => {
  it("declares package.json type module, so an install's .ts entries load as ES modules whatever the consumer's own package.json says", () => {
    expect(declaresModuleType.safeParse(installFiles["./package.json"]).error).toBeUndefined();
  });

  it("names package.json in the README's install path list", () => {
    expect(installFiles["./README.md"]).toMatch(INSTALL_LIST_NAMES_PACKAGE_JSON);
  });
});
