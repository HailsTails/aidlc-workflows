import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defaultPathOperations } from "./rin-harness-path-operations.ts";
import { defaultFileTextPort } from "./rin-harness-sidecar-file-reader.ts";

const pathOperations = defaultPathOperations();

const fileText = defaultFileTextPort();

const forkRoot = pathOperations.resolve({ segments: [import.meta.dirname, "..", "..", ".."] });

const trackedText = (request: { readonly path: string }): string =>
  fileText.read(pathOperations.join({ segments: [forkRoot, ...request.path.split("/")] }), "utf8");

const HONE_PACKAGE_NAME = "@hailstails/hone";

const HONE_PACKAGE_VERSION = "1.0.0";

const HONE_PACKAGE_INTEGRITY = "sha512-+RYeVvsEpBVFx4SK3wAycebc/IC64HSgRHDilvJ5MQ4YWa2PhvAO3ii0Xupz0BnlONLFEzc+Y0XUvhBJcQOHDQ==";

const CONDITIONAL_KEY_LINE = /^\s*(?:-\s+)?["']?if["']?\s*:/m;

const constitutionScopeSchema = z.object({ constitution: z.object({ include: z.array(z.string()) }) });

const constitutionEngineSchema = z.object({ constitution: z.object({ engine: z.string(), baseRevision: z.string() }) });

const developmentManifestSchema = z.object({
  devDependencies: z.record(z.string(), z.string()),
  scripts: z.record(z.string(), z.string()),
});

const NODE_SETUP_STEP = `      - uses: actions/setup-node@v4
        with:
          node-version: 22.18.0
`;

const FORK_INSTALL_STEP = `      - name: Install dependencies
        run: bun install --frozen-lockfile
`;

const WINDOWS_JOB_STEPS = `  hone-windows:
    name: Hone on Windows
    runs-on: windows-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd
      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6
        with:
          bun-version: '1.4.2'
${NODE_SETUP_STEP}${FORK_INSTALL_STEP}      - name: Prove rin's Hone check resolution against the pinned @hailstails/hone release
        run: bun run test:rin:hone
`;

const SOURCE_CHECKS_JOB_START = `  source-checks:
    name: Source checks
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd
        with:
          fetch-depth: 0
      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6
        with:
          bun-version: '1.4.2'
${NODE_SETUP_STEP}${FORK_INSTALL_STEP}      - name: Generate distributions imported by source and test checks
`;

const FORK_HONE_CHECK_STEP = `      - name: Check the fork against its selected disciplines with the pinned @hailstails/hone release
        run: bun run --silent hone:check --base-revision "\${{ github.event.pull_request.base.sha || 'origin/main' }}"
`;

describe("the fork as a consumer of the pinned @hailstails/hone release (CD-47: what this repository's own CI workflow, manifest, lock and harness config say is the assertion's subject, and no fake can stand in for it, so the test reads those tracked files read-only)", () => {
  it("installs the fork, with the pinned @hailstails/hone release, then proves rin's Hone check resolution against it, in the Windows job", () => {
    expect(trackedText({ path: ".github/workflows/rin-ci.yml" })).toContain(WINDOWS_JOB_STEPS);
  });

  it("goes straight from installing the fork to its source checks, with no core source to build, in the source-checks job", () => {
    expect(trackedText({ path: ".github/workflows/rin-ci.yml" })).toContain(SOURCE_CHECKS_JOB_START);
  });

  it("never conditionally skips a required job or any of its steps, because a skipped job counts as a passing required check", () => {
    expect(trackedText({ path: ".github/workflows/rin-ci.yml" })).not.toMatch(CONDITIONAL_KEY_LINE);
  });

  it("runs the hone resolution tests by name", () => {
    expect(developmentManifestSchema.parse(JSON.parse(trackedText({ path: "package.json" }))).scripts["test:rin:hone"]).toBe(
      "vitest run --config vitest.rin.config.ts plugins/rin/tools/rin-disciplines plugins/rin/hooks/rin-constitution-engine-gate-decision plugins/rin/tools/hone-fork-wiring plugins/rin/tools/rin-harness-config-constitution-engine",
    );
  });

  it("depends on the Hone package only as its exact registry version", () => {
    const manifest = developmentManifestSchema.parse(JSON.parse(trackedText({ path: "package.json" })));
    expect(manifest.devDependencies[HONE_PACKAGE_NAME]).toBe(HONE_PACKAGE_VERSION);
    expect(manifest.devDependencies["honed"]).toBeUndefined();
  });

  it("locks the registry release to its integrity", () => {
    expect(trackedText({ path: "bun.lock" })).toContain(`"${HONE_PACKAGE_NAME}": ["${HONE_PACKAGE_NAME}@${HONE_PACKAGE_VERSION}", `);
    expect(trackedText({ path: "bun.lock" })).toContain(`"bin": { "hone": "core/check/tool-command.js" } }, "${HONE_PACKAGE_INTEGRITY}"],`);
  });

  it("checks the fork itself with the pinned release, measured from the pull request's base, in the source-checks job", () => {
    expect(trackedText({ path: ".github/workflows/rin-ci.yml" })).toContain(FORK_HONE_CHECK_STEP);
  });

  it("runs the Hone check and projection by name", () => {
    const manifest = developmentManifestSchema.parse(JSON.parse(trackedText({ path: "package.json" })));
    expect(manifest.scripts["hone:check"]).toBe("hone check --repo .");
    expect(manifest.scripts["hone:project"]).toBe("hone project --repo .");
  });

  it("names Hone as the fork's constitution engine, measured from the main branch", () => {
    expect(constitutionEngineSchema.parse(JSON.parse(trackedText({ path: "harness.config.json" }))).constitution).toMatchObject({
      engine: "hone",
      baseRevision: "origin/main",
    });
  });

  it("leaves the core's source out of the constitution audit's scope, since the fork no longer carries it", () => {
    expect(constitutionScopeSchema.parse(JSON.parse(trackedText({ path: "harness.config.json" }))).constitution.include).toEqual(["plugins/rin/**"]);
  });
});
