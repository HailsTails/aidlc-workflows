export type MovedFile = {
  readonly from: string;
  readonly to: string;
  readonly blob: string;
};

export type AddedFile = {
  readonly path: string;
  readonly source: string;
  readonly mode: string;
};

export type OptionalPatch = {
  readonly name: string;
  readonly file: string;
  readonly readmeNote: string;
};

export type ShapePlan = {
  readonly strippedFolders: readonly string[];
  readonly strippedFiles: readonly string[];
  readonly movedFiles: readonly MovedFile[];
  readonly pinnedFiles: readonly string[];
  readonly patchFolder: string;
  readonly optionalPatches: readonly OptionalPatch[];
  readonly addedFiles: readonly AddedFile[];
  readonly bridgeMapSource: string;
  readonly bridgeMapPath: string;
  readonly readmeTemplate: string;
  readonly readmePath: string;
};

const GATE = "lint/gate";
const PARITY = "scripts/parity";

const moved = (path: string, blob: string): MovedFile => ({
  from: `${GATE}/${path}`,
  to: `${PARITY}/${path}`,
  blob,
});

export const SHAPE_PLAN: ShapePlan = {
  strippedFolders: ["lint/", "tests/ratchets/"],
  strippedFiles: [
    "scripts/gate.ts",
    "disciplines.json",
    "disciplines.eslint.mjs",
    "disciplines.eslint.d.mts",
    "discipline-exceptions.json",
    "lanes.json",
    "eslint.config.ts",
    "eslint.config.test.ts",
  ],
  movedFiles: [
    moved("domain/golden.ts", "804c7e466dd252f7524364e7bf283a8e52f4b194"),
    moved("domain/outcome.ts", "1df03c2003e925200344807aa03d8a3ac8ab5fcd"),
    moved("domain/install-lifecycle.ts", "97f7e6a0be5488d43fdf3f888681cbf6dec57931"),
    moved("domain/install-lifecycle.test.ts", "2a2a055e519471670de19353083b0c94a5c07bf8"),
    moved("adapters/golden-files.ts", "1265a09a88731dfe90ba681268f616c20f1bb9f2"),
    moved("adapters/golden-files.test.ts", "478e9fe96d4a79c3dd66c261853a07b00b8d4302"),
    moved("adapters/file-workspace.ts", "541278dab59399fae0a5eec25381d454b3e26f29"),
    moved("adapters/file-workspace.test.ts", "51d06c09d16066552013e26fe49f84ee2144a093"),
    moved("adapters/lifecycle-fixtures.ts", "df7886c54d2be50f074d4945b167ce7e766cdff2"),
    moved("adapters/copy-install-lab.ts", "a632441b5f0e5a02253c7e174678b05cbc9f08ef"),
    moved("application/goldens-check.ts", "5a64775778e1bc06b689b27f09bb7d1741b3f8b3"),
    moved("application/harness-discovery.ts", "930bd13df75b0453e7b06fe61e60fed1616a64ea"),
    moved("application/harness-discovery.test.ts", "a65893f2158f47addcab7b05bf9a73af42007283"),
    moved("application/install-lifecycle.ts", "072fd9f63bd184630eb477f6f887160ef371e50f"),
    moved("application/ports.ts", "29870ad3696c6aecb40704f6fec7bed43fb5d991"),
    moved("install-lifecycle.ts", "9ba27fe0c01583c71cfdada100a8dbbe1bc967cd"),
  ],
  pinnedFiles: [
    "biome.json",
    "package.json",
    "bun.lock",
    "tests/run-tests.ts",
    "tests/harness/runner-profile.ts",
    "tests/lib/e2e-workers.ts",
    "tests/unit/t-aidlc-lib-only-shrinks.test.ts",
    "tests/fixtures/aidlc-lib-declarations.txt",
    "tests/integration/t-e2e-isolated-runner.test.ts",
    "tests/integration/t-e2e-native-cancellation.test.ts",
    "tests/integration/t-runner-process-lifecycle.test.ts",
    "tests/unit/t-runner-production-guards.test.ts",
    "tests/unit/t-e2e-temporary-root.test.ts",
    "tests/unit-shard-weights.json",
  ],
  patchFolder: "patches",
  optionalPatches: [
    {
      name: "gitleaks-golden-allowlist",
      file: "patches-optional/gitleaks-golden-allowlist.patch",
      readmeNote:
        "The goldens are generated hash maps, so `.gitleaks.toml` allowlists `tests/golden/` by path, " +
        "following the existing pattern from [#161](https://github.com/awslabs/aidlc-workflows/pull/161) " +
        "and [#678](https://github.com/awslabs/aidlc-workflows/pull/678).",
    },
  ],
  addedFiles: [
    { path: `${PARITY}/dist-goldens.ts`, source: "overlay/scripts/parity/dist-goldens.ts", mode: "100644" },
    { path: "tests/unit/t-package-sources.test.ts", source: "overlay/tests/unit/t-package-sources.test.ts", mode: "100644" },
  ],
  bridgeMapSource: "lint/context-map.ts",
  bridgeMapPath: "src/bridge-map.json",
  readmeTemplate: "templates/PARITY.md",
  readmePath: "PARITY.md",
};

export const isStripped = (plan: ShapePlan, path: string): boolean =>
  plan.strippedFiles.includes(path) || plan.strippedFolders.some((folder) => path.startsWith(folder));
