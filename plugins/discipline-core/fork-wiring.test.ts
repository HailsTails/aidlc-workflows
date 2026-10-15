import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createDefaultFileTextPort } from "./core/platform-ports/file-text-port.ts";
import { createDefaultPathPort } from "./core/platform-ports/path-port.ts";

const forkRoot = createDefaultPathPort({}).resolve({ path: `${import.meta.dirname}/../..` });
const fileText = createDefaultFileTextPort({});

const readOkSchema = z.object({ outcome: z.literal("ok"), value: z.string() });
const harnessConfigSchema = z.object({ constitution: z.object({ include: z.array(z.string()) }) });

describe("the fork's CI and audit wiring for discipline core (CD-47: what this repository's own CI workflow and harness config say is the assertion's subject, and no fake can stand in for it, so the test reads those two tracked files read-only)", () => {
  it("runs discipline core's tests in CI straight after installing dependencies", () => {
    expect(readOkSchema.parse(fileText.read({ path: `${forkRoot}/.github/workflows/rin-ci.yml` })).value).toContain(
      "      - name: Install dependencies\n        run: bun install --frozen-lockfile\n      - name: Check discipline core\n        run: bun run --cwd plugins/discipline-core check\n",
    );
  });

  it("puts discipline core inside the constitution audit's scope", () => {
    expect(
      harnessConfigSchema.parse(JSON.parse(readOkSchema.parse(fileText.read({ path: `${forkRoot}/harness.config.json` })).value))
        .constitution.include,
    ).toContain("plugins/discipline-core/**");
  });
});
