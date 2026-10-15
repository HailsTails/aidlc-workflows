import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createDefaultFileTextPort } from "./core/platform-ports/file-text-port.ts";
import { createDefaultPathPort } from "./core/platform-ports/path-port.ts";

const resolvedSchema = z.object({ outcome: z.literal("ok"), value: z.string() });
const forkRoot = resolvedSchema.parse(createDefaultPathPort({}).resolve({ path: `${import.meta.dirname}/../..` })).value;
const fileText = createDefaultFileTextPort({});

const readOkSchema = z.object({ outcome: z.literal("ok"), value: z.string() });
const DISCIPLINE_CORE_STEPS = `      - uses: actions/setup-node@v4
        with:
          node-version: 22.18.0
      - name: Install dependencies
        run: bun install --frozen-lockfile
      - name: Check discipline core
        run: bun run --cwd plugins/discipline-core check
      - name: Prove a discipline core install
        run: bun run --cwd plugins/discipline-core install-proof
`;

const WINDOWS_JOB_STEPS = `  discipline-core-windows:
    name: Discipline core on Windows
    if: github.event_name != 'pull_request' || !github.event.pull_request.draft
    runs-on: windows-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd
      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6
        with:
          bun-version: '1.4.2'
${DISCIPLINE_CORE_STEPS}`;

const SOURCE_CHECKS_JOB_STEPS = `  source-checks:
    name: Source checks
    if: github.event_name != 'pull_request' || !github.event.pull_request.draft
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd
        with:
          fetch-depth: 0
      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6
        with:
          bun-version: '1.4.2'
${DISCIPLINE_CORE_STEPS}`;

const harnessConfigSchema = z.object({ constitution: z.object({ include: z.array(z.string()) }) });

describe("the fork's CI and audit wiring for discipline core (CD-47: what this repository's own CI workflow and harness config say is the assertion's subject, and no fake can stand in for it, so the test reads those two tracked files read-only)", () => {
  it("sets up Node 22.18.0, then checks discipline core and proves an install, in the Windows job", () => {
    expect(readOkSchema.parse(fileText.read({ path: `${forkRoot}/.github/workflows/rin-ci.yml` })).value).toContain(WINDOWS_JOB_STEPS);
  });

  it("sets up Node 22.18.0, then checks discipline core and proves an install, in the source-checks job", () => {
    expect(readOkSchema.parse(fileText.read({ path: `${forkRoot}/.github/workflows/rin-ci.yml` })).value).toContain(
      SOURCE_CHECKS_JOB_STEPS,
    );
  });

  it("puts discipline core inside the constitution audit's scope", () => {
    expect(
      harnessConfigSchema.parse(JSON.parse(readOkSchema.parse(fileText.read({ path: `${forkRoot}/harness.config.json` })).value))
        .constitution.include,
    ).toContain("plugins/discipline-core/**");
  });
});
