import { assert, describe, expect, it } from "vitest";
import { supportedRange, type ToolchainRequirement } from "./core/mechanism-port/toolchain-requirement.ts";
import { parsedJson } from "./core/rule-set-reader/rule-set-reader.ts";
import { TYPESCRIPT_REQUIREMENT } from "./mechanisms/audit/runner/typescript-parse.ts";
import {
  ESLINT_REQUIREMENT,
  ESLINT_TOOLCHAIN_REQUIREMENTS,
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

const sectionOf = (request: { readonly json: unknown; readonly name: string }): unknown =>
  typeof request.json === "object" && request.json !== null
    ? Object.entries(request.json).find(([key]) => key === request.name)?.[1]
    : undefined;

const namesIn = (request: { readonly json: unknown; readonly name: string }): readonly string[] => {
  const section = sectionOf(request);
  return typeof section === "object" && section !== null ? Object.keys(section) : [];
};

const DEVELOPMENT_MANIFEST = jsonOf({ key: "./package.json" });

const INSTALL_MANIFEST = jsonOf({ key: "./install/package.json" });

const INSTALL_LOCK = jsonOf({ key: "./install/package-lock.json" });

const REQUIREMENTS: readonly ToolchainRequirement[] = [...ESLINT_TOOLCHAIN_REQUIREMENTS, TYPESCRIPT_REQUIREMENT];

const floorAlias = (request: { readonly requirement: ToolchainRequirement; readonly line: number }): string =>
  `npm:${request.requirement.packageName}@${request.requirement.lines[request.line]?.floor}`;

const NODE_MODULES_PREFIX = "node_modules/";

const lockedPackageNames = (): readonly string[] =>
  namesIn({ json: INSTALL_LOCK, name: "packages" })
    .filter((key) => key !== "")
    .map((key) => key.slice(key.lastIndexOf(NODE_MODULES_PREFIX) + NODE_MODULES_PREFIX.length));

describe("the install's own module type, read as build-time raw files (CD-47: this package's manifests are the assertion's subject and no fake can stand in for them; nothing is spawned or written)", () => {
  it("declares type module in the install manifest, so an install's .ts entries load as ES modules whatever the consumer's own package.json says", () => {
    expect(INSTALL_MANIFEST).toMatchObject({ type: "module" });
  });
});

describe("the development manifest's toolchain declarations, read as build-time raw files (CD-47: this package's manifest is the assertion's subject; nothing is spawned or written)", () => {
  it("declares every toolchain package a mechanism loads as a peer whose range is the one the mechanism checks at run time", () => {
    expect(sectionOf({ json: DEVELOPMENT_MANIFEST, name: "peerDependencies" })).toEqual(
      Object.fromEntries(REQUIREMENTS.map((requirement) => [requirement.packageName, supportedRange({ requirement })])),
    );
  });

  it("marks every peer optional, so npm never installs a copy of the toolchain inside the core install, where it would shadow the repository's", () => {
    expect(sectionOf({ json: DEVELOPMENT_MANIFEST, name: "peerDependenciesMeta" })).toEqual(
      Object.fromEntries(REQUIREMENTS.map((requirement) => [requirement.packageName, { optional: true }])),
    );
  });

  it("pins each peer's floor as a development dependency, so the tests run core on the oldest release each range admits", () => {
    expect(DEVELOPMENT_MANIFEST).toMatchObject({
      devDependencies: {
        "typescript-floor": floorAlias({ requirement: TYPESCRIPT_REQUIREMENT, line: 0 }),
        "eslint-9-floor": floorAlias({ requirement: ESLINT_REQUIREMENT, line: 0 }),
        "eslint-10-floor": floorAlias({ requirement: ESLINT_REQUIREMENT, line: 1 }),
        "typescript-eslint-parser-floor": floorAlias({ requirement: TYPESCRIPT_ESLINT_PARSER_REQUIREMENT, line: 0 }),
        "typescript-eslint-plugin-floor": floorAlias({ requirement: TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT, line: 0 }),
      },
    });
  });

  it("ships only core's own implementation packages as exact-pinned dependencies, none of them a peer", () => {
    expect(DEVELOPMENT_MANIFEST).toMatchObject({
      dependencies: {
        "@eslint/plugin-kit": expect.stringMatching(/^\d+\.\d+\.\d+$/),
        "jsonc-parser": expect.stringMatching(/^\d+\.\d+\.\d+$/),
        zod: expect.stringMatching(/^\d+\.\d+\.\d+$/),
      },
    });
  });
});

describe("what an adopter installs, read as build-time raw files (CD-47: the shipped install manifest and lock are the assertion's subject; nothing is spawned or written)", () => {
  it("ships no lock of the development tree beside the development manifest", () => {
    expect(Object.keys(manifestFiles)).not.toContain("./package-lock.json");
  });

  it("ships the install manifest generated from the development manifest, with no scripts or development dependencies", () => {
    expect(installManifestOf({ developmentManifest: requiredEntry({ table: manifestFiles, key: "./package.json" }) })).toEqual({
      outcome: "ok",
      value: requiredEntry({ table: manifestFiles, key: "./install/package.json" }),
    });
  });

  it("ships a lock whose root entry declares exactly the install manifest's dependencies and peers, and no development dependency", () => {
    const root = sectionOf({ json: sectionOf({ json: INSTALL_LOCK, name: "packages" }), name: "" });
    expect({
      dependencies: sectionOf({ json: root, name: "dependencies" }),
      peerDependencies: sectionOf({ json: root, name: "peerDependencies" }),
      devDependencies: namesIn({ json: root, name: "devDependencies" }),
    }).toEqual({
      dependencies: sectionOf({ json: INSTALL_MANIFEST, name: "dependencies" }),
      peerDependencies: sectionOf({ json: INSTALL_MANIFEST, name: "peerDependencies" }),
      devDependencies: [],
    });
  });

  it("locks no development package and no toolchain peer, only core's own packages and what they need", () => {
    const excluded = [
      ...namesIn({ json: DEVELOPMENT_MANIFEST, name: "devDependencies" }),
      ...REQUIREMENTS.map((requirement) => requirement.packageName),
    ];
    expect(lockedPackageNames().filter((name) => excluded.includes(name))).toEqual([]);
  });

  it("locks each of core's own packages", () => {
    expect(lockedPackageNames()).toEqual(expect.arrayContaining([...namesIn({ json: INSTALL_MANIFEST, name: "dependencies" })]));
  });
});
