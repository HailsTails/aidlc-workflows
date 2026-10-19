import { assert, describe, expect, it } from "vitest";
import { createDefaultFileTextPort } from "../../discipline-core/core/platform-ports/file-text-port.ts";
import { createDefaultPathPort } from "../../discipline-core/core/platform-ports/path-port.ts";
import { parsedJson } from "../../discipline-core/core/rule-set-reader/rule-set-reader.ts";

const resolvedForkRoot = (): string => {
  const resolved = createDefaultPathPort({}).resolve({ path: `${import.meta.dirname}/../../..` });
  assert(resolved.outcome === "ok", "the fork root resolves to an absolute path");
  return resolved.value;
};

const forkRoot = resolvedForkRoot();
const fileText = createDefaultFileTextPort({});

const trackedText = (request: { readonly path: string }): string => {
  const read = fileText.read({ path: `${forkRoot}/${request.path}` });
  assert(read.outcome === "ok", `${request.path} reads`);
  return read.value;
};

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

describe("the fork's CI and audit wiring for discipline core (CD-47: what this repository's own CI workflow and harness config say is the assertion's subject, and no fake can stand in for it, so the test reads those two tracked files read-only)", () => {
  it("sets up Node 22.18.0, then checks discipline core and proves an install, in the Windows job", () => {
    expect(trackedText({ path: ".github/workflows/rin-ci.yml" })).toContain(WINDOWS_JOB_STEPS);
  });

  it("sets up Node 22.18.0, then checks discipline core and proves an install, in the source-checks job", () => {
    expect(trackedText({ path: ".github/workflows/rin-ci.yml" })).toContain(SOURCE_CHECKS_JOB_STEPS);
  });

  it("puts discipline core inside the constitution audit's scope", () => {
    expect(parsedJson({ text: trackedText({ path: "harness.config.json" }) })).toMatchObject({
      outcome: "ok",
      value: { constitution: { include: expect.arrayContaining(["plugins/discipline-core/**"]) } },
    });
  });
});
