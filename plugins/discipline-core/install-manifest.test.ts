import { assert, describe, expect, it } from "vitest";
import { supportedRange } from "./core/mechanism-port/toolchain-requirement.ts";
import { parsedJson } from "./core/rule-set-reader/rule-set-reader.ts";
import { TYPESCRIPT_REQUIREMENT as AUDIT_TYPESCRIPT_REQUIREMENT } from "./mechanisms/audit/runner/typescript-parse.ts";
import { ESLINT_TOOLCHAIN_REQUIREMENTS } from "./mechanisms/eslint/runner/eslint-toolchain.ts";
import { requiredEntry } from "./tests/required-entry.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const installFiles = import.meta.glob(["./package.json", "./package-lock.json"], {
  base: "./",
  query: "?raw",
  import: "default",
  eager: true,
});

const jsonOf = (request: { readonly key: string }): unknown => {
  const parsed = parsedJson({ text: requiredEntry({ table: installFiles, key: request.key }) });
  assert(parsed.outcome === "ok", `${request.key} parses as JSON`);
  return parsed.value;
};

const sectionOf = (request: { readonly json: unknown; readonly name: string }): unknown =>
  typeof request.json === "object" && request.json !== null
    ? Object.entries(request.json).find(([key]) => key === request.name)?.[1]
    : undefined;

const MANIFEST = jsonOf({ key: "./package.json" });

const LOCK = jsonOf({ key: "./package-lock.json" });

const REQUIREMENTS = [...ESLINT_TOOLCHAIN_REQUIREMENTS, AUDIT_TYPESCRIPT_REQUIREMENT];

const DEV_PINS_AT_EACH_FLOOR = {
  typescript: "6.0.3",
  eslint: "10.11.0",
  "eslint-9": "npm:eslint@9.39.5",
  "@typescript-eslint/parser": "8.71.2",
  "@typescript-eslint/eslint-plugin": "8.71.2",
};

const EXACT_VERSION = /^\d+\.\d+\.\d+$/;

describe("the install's own module type, read as build-time raw files (CD-47: this package's manifest is the assertion's subject and no fake can stand in for it; nothing is spawned or written)", () => {
  it("declares package.json type module, so an install's .ts entries load as ES modules whatever the consumer's own package.json says", () => {
    expect(MANIFEST).toMatchObject({ type: "module" });
  });
});

describe("the install's dependency split, read as build-time raw files (CD-47: this package's manifest and lockfile are the assertion's subject; nothing is spawned or written)", () => {
  it("declares every toolchain package a mechanism loads as a peer whose range is the one the mechanism checks at run time", () => {
    expect(MANIFEST).toMatchObject({
      peerDependencies: Object.fromEntries(
        REQUIREMENTS.map((requirement) => [requirement.packageName, supportedRange({ requirement })]),
      ),
    });
  });

  it("marks the ESLint mechanism's peers optional, so an audit-only adopter installs only typescript", () => {
    expect(MANIFEST).toMatchObject({
      peerDependenciesMeta: {
        eslint: { optional: true },
        "@typescript-eslint/parser": { optional: true },
        "@typescript-eslint/eslint-plugin": { optional: true },
      },
    });
  });

  it("pins the floor of every supported release line as an exact development dependency, so the tests run on each line core supports", () => {
    expect(MANIFEST).toMatchObject({
      devDependencies: DEV_PINS_AT_EACH_FLOOR,
    });
  });

  it("ships only core's own implementation packages as exact-pinned dependencies, none of them a peer", () => {
    expect(MANIFEST).toMatchObject({
      dependencies: {
        "@eslint/plugin-kit": expect.stringMatching(EXACT_VERSION),
        "jsonc-parser": expect.stringMatching(EXACT_VERSION),
        zod: expect.stringMatching(EXACT_VERSION),
      },
    });
  });

  it("ships a lockfile whose root entry declares exactly the manifest's dependencies, peers and development dependencies", () => {
    expect(LOCK).toMatchObject({
      packages: {
        "": {
          dependencies: sectionOf({ json: MANIFEST, name: "dependencies" }),
          peerDependencies: sectionOf({ json: MANIFEST, name: "peerDependencies" }),
          devDependencies: sectionOf({ json: MANIFEST, name: "devDependencies" }),
        },
      },
    });
  });
});
