import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defaultPathOperations } from "./rin-harness-path-operations.ts";
import { defaultFileTextPort } from "./rin-harness-sidecar-file-reader.ts";

const pathOperations = defaultPathOperations();

const fileText = defaultFileTextPort();

const forkRoot = pathOperations.resolve({ segments: [import.meta.dirname, "..", "..", ".."] });

const trackedText = (request: { readonly path: string }): string =>
  fileText.read(pathOperations.join({ segments: [forkRoot, ...request.path.split("/")] }), "utf8");

const HONED_RELEASE_URL = "https://github.com/HailsTails/hone/releases/download/v0.1.0-pre.1/honed-0.1.0-pre.1.tgz";

const HONED_RELEASE_INTEGRITY = "sha512-GdDzVrkdpf0nx0f5W3xhJNyGWlFAiQpuUbaC+Bhhrxk8vo35AuHEjXk3jhbjn+ZZNYwUM3mMQhagZScNxV476Q==";

const CONDITIONAL_KEY_LINE = /^\s*(?:-\s+)?["']?if["']?\s*:/m;

const constitutionScopeSchema = z.object({ constitution: z.object({ include: z.array(z.string()) }) });

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
${NODE_SETUP_STEP}${FORK_INSTALL_STEP}      - name: Prove rin's Hone check resolution against the pinned honed release
        run: bun run test:rin:honed
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

describe("the fork as a consumer of the pinned honed release (CD-47: what this repository's own CI workflow, manifest, lock and harness config say is the assertion's subject, and no fake can stand in for it, so the test reads those tracked files read-only)", () => {
  it("installs the fork, with the pinned honed release, then proves rin's Hone check resolution against it, in the Windows job", () => {
    expect(trackedText({ path: ".github/workflows/rin-ci.yml" })).toContain(WINDOWS_JOB_STEPS);
  });

  it("goes straight from installing the fork to its source checks, with no core source to build, in the source-checks job", () => {
    expect(trackedText({ path: ".github/workflows/rin-ci.yml" })).toContain(SOURCE_CHECKS_JOB_START);
  });

  it("never conditionally skips a required job or any of its steps, because a skipped job counts as a passing required check", () => {
    expect(trackedText({ path: ".github/workflows/rin-ci.yml" })).not.toMatch(CONDITIONAL_KEY_LINE);
  });

  it("runs the honed resolution tests by name", () => {
    expect(developmentManifestSchema.parse(JSON.parse(trackedText({ path: "package.json" }))).scripts["test:rin:honed"]).toBe(
      "vitest run --config vitest.rin.config.ts plugins/rin/tools/rin-disciplines plugins/rin/hooks/rin-constitution-engine-gate-decision plugins/rin/tools/honed-fork-wiring plugins/rin/tools/rin-harness-config-constitution-engine",
    );
  });

  it("depends on honed only as the exact release tarball", () => {
    expect(developmentManifestSchema.parse(JSON.parse(trackedText({ path: "package.json" }))).devDependencies["honed"]).toBe(HONED_RELEASE_URL);
  });

  it("locks the release tarball to its integrity", () => {
    expect(trackedText({ path: "bun.lock" })).toContain(`"honed": ["honed@${HONED_RELEASE_URL}", `);
    expect(trackedText({ path: "bun.lock" })).toContain(`"bin": { "hone": "core/check/tool-command.js" } }, "${HONED_RELEASE_INTEGRITY}"],`);
  });

  it("leaves the core's source out of the constitution audit's scope, since the fork no longer carries it", () => {
    expect(constitutionScopeSchema.parse(JSON.parse(trackedText({ path: "harness.config.json" }))).constitution.include).toEqual(["plugins/rin/**"]);
  });
});
