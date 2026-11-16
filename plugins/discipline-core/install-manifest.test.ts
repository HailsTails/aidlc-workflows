import { assert, describe, expect, it } from "vitest";
import { supportedRange } from "./core/mechanism-port/toolchain-requirement.ts";
import { parsedJson } from "./core/rule-set-reader/rule-set-reader.ts";
import { TYPESCRIPT_REQUIREMENT } from "./mechanisms/audit/runner/typescript-parse.ts";
import {
  ESLINT_REQUIREMENT,
  TYPESCRIPT_ESLINT_PARSER_REQUIREMENT,
  TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT,
} from "./mechanisms/eslint/runner/eslint-toolchain.ts";
import { installManifestOf } from "./scripts/install-manifest.ts";
import { requiredEntry } from "./tests/required-entry.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const manifestFiles = import.meta.glob(["./package.json", "./package-lock.json", "./install/package.json", "./install/package-lock.json"], {
  base: "./",
  query: "?raw",
  import: "default",
  eager: true,
});

const jsonOf = (request: { readonly key: string }): unknown => {
  const parsed = parsedJson({ text: requiredEntry({ table: manifestFiles, key: request.key }) });
  assert(parsed.outcome === "ok", `${request.key} parses as JSON`);
  return parsed.value;
};

const DEVELOPMENT_MANIFEST = jsonOf({ key: "./package.json" });

const INSTALL_MANIFEST = jsonOf({ key: "./install/package.json" });

const INSTALL_LOCK = jsonOf({ key: "./install/package-lock.json" });

const OPTIONAL = { optional: true };

const PEERS = {
  "@typescript-eslint/eslint-plugin": supportedRange({ requirement: TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT }),
  "@typescript-eslint/parser": supportedRange({ requirement: TYPESCRIPT_ESLINT_PARSER_REQUIREMENT }),
  eslint: supportedRange({ requirement: ESLINT_REQUIREMENT }),
  typescript: supportedRange({ requirement: TYPESCRIPT_REQUIREMENT }),
};

const PEERS_META = {
  "@typescript-eslint/eslint-plugin": OPTIONAL,
  "@typescript-eslint/parser": OPTIONAL,
  eslint: OPTIONAL,
  typescript: OPTIONAL,
};

const CORE_DEPENDENCIES = { "@eslint/plugin-kit": "0.7.3", "jsonc-parser": "3.3.1", zod: "4.4.3" };

describe("the install's own module type, read as build-time raw files (CD-47: this package's manifests are the assertion's subject and no fake can stand in for them; nothing is spawned or written)", () => {
  it("declares type module in the install manifest, so an install's .ts entries load as ES modules whatever the consumer's own package.json says", () => {
    expect(INSTALL_MANIFEST).toMatchObject({ type: "module" });
  });
});

describe("the development manifest's toolchain declarations, read as build-time raw files (CD-47: this package's manifest is the assertion's subject; nothing is spawned or written)", () => {
  it("declares every toolchain package a mechanism loads as a peer whose range is the one the mechanism checks at run time", () => {
    expect(DEVELOPMENT_MANIFEST).toEqual(expect.objectContaining({ peerDependencies: PEERS }));
  });

  it("marks every peer optional, so npm never installs a copy of the toolchain inside the core install, where it would shadow the repository's", () => {
    expect(DEVELOPMENT_MANIFEST).toEqual(expect.objectContaining({ peerDependenciesMeta: PEERS_META }));
  });

  it("pins each peer's floor as a development dependency, so the tests run core on the oldest release each range admits", () => {
    expect(DEVELOPMENT_MANIFEST).toMatchObject({
      devDependencies: {
        "typescript-floor": `npm:typescript@${TYPESCRIPT_REQUIREMENT.lines[0]?.floor}`,
        "eslint-9-floor": `npm:eslint@${ESLINT_REQUIREMENT.lines[0]?.floor}`,
        "eslint-10-floor": `npm:eslint@${ESLINT_REQUIREMENT.lines[1]?.floor}`,
        "typescript-eslint-parser-floor": `npm:@typescript-eslint/parser@${TYPESCRIPT_ESLINT_PARSER_REQUIREMENT.lines[0]?.floor}`,
        "typescript-eslint-plugin-floor": `npm:@typescript-eslint/eslint-plugin@${TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT.lines[0]?.floor}`,
      },
    });
  });

  it("ships only core's own implementation packages as exact-pinned dependencies, none of them a peer", () => {
    expect(DEVELOPMENT_MANIFEST).toEqual(expect.objectContaining({ dependencies: CORE_DEPENDENCIES }));
  });
});

describe("what an adopter installs, read as build-time raw files (CD-47: the shipped install manifest and lock are the assertion's subject; nothing is spawned or written)", () => {
  it("ships no lock of the development tree beside the development manifest", () => {
    expect(manifestFiles).not.toHaveProperty(["./package-lock.json"]);
  });

  it("ships the install manifest generated from the development manifest, with no scripts or development dependencies", () => {
    expect(installManifestOf({ developmentManifest: requiredEntry({ table: manifestFiles, key: "./package.json" }) })).toEqual({
      outcome: "ok",
      value: requiredEntry({ table: manifestFiles, key: "./install/package.json" }),
    });
  });

  it("ships a lock whose root entry declares exactly core's dependencies and optional peers, and no development dependency", () => {
    expect(INSTALL_LOCK).toEqual(
      expect.objectContaining({
        packages: expect.objectContaining({
          "": {
            version: "0.0.0",
            license: "MIT-0",
            dependencies: CORE_DEPENDENCIES,
            engines: { node: ">=22.18.0" },
            peerDependencies: PEERS,
            peerDependenciesMeta: PEERS_META,
          },
        }),
      }),
    );
  });

  it("locks core's own packages and what they need, and no development package or toolchain peer", () => {
    expect(INSTALL_LOCK).toEqual(
      expect.objectContaining({
        packages: {
          "": expect.any(Object),
          "node_modules/@eslint/core": expect.any(Object),
          "node_modules/@eslint/plugin-kit": expect.any(Object),
          "node_modules/@types/json-schema": expect.any(Object),
          "node_modules/jsonc-parser": expect.any(Object),
          "node_modules/levn": expect.any(Object),
          "node_modules/prelude-ls": expect.any(Object),
          "node_modules/type-check": expect.any(Object),
          "node_modules/zod": expect.any(Object),
        },
      }),
    );
  });
});
