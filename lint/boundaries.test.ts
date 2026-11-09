import { describe, expect, test, type AsymmetricMatcher } from "bun:test";
import { boundaryConfig, typeBridgeConfigs } from "./boundaries.ts";
import { Linter } from "./eslint-port.ts";
import { legacyOwnership } from "./restrictions.ts";
import { standardsConfig } from "./standards.ts";

const BOUNDARIES: Linter.Config[] = [...standardsConfig, ...boundaryConfig];

describe("boundaryConfig in production code", () => {
  test("refuses a platform import in a domain module", () => {
    const messages = new Linter({ configType: "flat" }).verify(
      'import { readFileSync } from "node:fs";\nexport const read = readFileSync;\n',
      BOUNDARIES,
      { filename: "src/execution/domain/reader.ts" },
    );

    expect(messages).toContainEqual(
      expect.objectContaining({ ruleId: "no-restricted-imports", line: 1 }),
    );
  });

  test("keeps the kernel pure", () => {
    const messages = new Linter({ configType: "flat" }).verify(
      'import { z } from "zod";\nexport const name = z.string();\n',
      BOUNDARIES,
      { filename: "src/kernel/names.ts" },
    );

    expect(messages).toContainEqual(
      expect.objectContaining({ ruleId: "no-restricted-imports", line: 1 }),
    );
  });

  test("refuses one context reaching into another's adapters", () => {
    const messages = new Linter({ configType: "flat" }).verify(
      'import { stageFile } from "../../workflow-definition/adapters/stage-file.ts";\n' +
        "export const file = stageFile;\n",
      BOUNDARIES,
      { filename: "src/projection/adapters/reader.ts" },
    );

    expect(messages).toContainEqual(
      expect.objectContaining({ ruleId: "no-restricted-imports", line: 1 }),
    );
  });
});

const findingsFor = (code: string, filename: string): Linter.LintMessage[] =>
  new Linter({ configType: "flat" }).verify(code, BOUNDARIES, { filename });

const UNDECLARED = "not a layer of a context in lint/context-map.ts";

describe("boundaryConfig outside the declared layers", () => {
  test.each([
    "src/execution/services/runner.ts",
    "src/shared/ids.ts",
    "src/kernel/ids/stage-id.ts",
    "src/cli/domain/route.ts",
    "src/cli/application/route.ts",
  ])("refuses %s", (filename) => {
    expect(findingsFor("export const value = 1;\n", filename)).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining(UNDECLARED) }),
    );
  });

  test("leaves a declared layer to its own rules", () => {
    expect(findingsFor("export const value = 1;\n", "src/execution/domain/unit.ts")).toEqual([]);
  });
});

describe("boundaryConfig own-context layer arrows", () => {
  test.each([
    ["src/execution/domain/unit.ts", "../../execution/adapters/store.ts"],
    ["src/execution/domain/unit.ts", "../../execution/application/ports.ts"],
    ["src/execution/domain/unit.ts", "../main.ts"],
    ["src/execution/application/run.ts", "../../execution/main.ts"],
    ["src/execution/application/run.ts", "../../execution/adapters/store.ts"],
  ])("%s may not import %s", (filename, specifier) => {
    const code = `import { store } from "${specifier}";\nexport const used = store;\n`;

    expect(findingsFor(code, filename)).toContainEqual(
      expect.objectContaining({ ruleId: "no-restricted-imports" }),
    );
  });

  test("a pure layer may not import dynamically", () => {
    const code = 'export const load = () => import("node:fs");\n';

    expect(findingsFor(code, "src/execution/domain/unit.ts")).toContainEqual(
      expect.objectContaining({ ruleId: "no-restricted-syntax" }),
    );
  });

  test("a pure layer may not reach effects through globalThis", () => {
    const code = 'export const file = globalThis.Bun.file("x");\n';

    expect(findingsFor(code, "src/execution/domain/unit.ts")).toContainEqual(
      expect.objectContaining({ ruleId: "no-restricted-globals" }),
    );
  });
});

const refusal = (text: string): AsymmetricMatcher =>
  expect.objectContaining({
    ruleId: "no-restricted-syntax",
    message: expect.stringContaining(text),
  });

const ANY_REFUSAL = expect.objectContaining({ ruleId: "no-restricted-syntax" });

const UNGLOSSED = "the glossary does not name";

describe("boundaryConfig published types", () => {
  test("refuses a domain type the context's glossary does not name", () => {
    const code = "export type ProjectedStage = { readonly slug: string };\n";

    expect(findingsFor(code, "src/projection/domain/stage.ts")).toContainEqual(
      refusal(UNGLOSSED),
    );
  });

  test("refuses a port the context's glossary does not name", () => {
    const code = "export interface StageCache {\n  read(): string;\n}\n";

    expect(findingsFor(code, "src/execution/application/ports.ts")).toContainEqual(
      refusal(UNGLOSSED),
    );
  });

  test("refuses a port in a ports concept file the context's glossary does not name", () => {
    const code = "export interface StageCache {\n  read(): string;\n}\n";

    expect(findingsFor(code, "src/projection/application/ports/stages.ts")).toContainEqual(
      refusal(UNGLOSSED),
    );
  });

  test("accepts a type the context's glossary names", () => {
    const code = "export type ProjectedFile = { readonly path: string };\n";

    expect(findingsFor(code, "src/projection/domain/projected-file.ts")).not.toContainEqual(
      ANY_REFUSAL,
    );
  });
});

const HARNESS_NAME = "Harness name:";

describe("boundaryConfig harness names outside src/hosts", () => {
  test.each([
    ['export const folders = { claude: "skills" };\n', "a property key"],
    ['export const isKiro = (names: string[]) => names.includes("kiro");\n', "a string"],
    ['export type Host = "codex" | "cursor";\n', "a literal type"],
    ['export const skills = ".claude/skills";\n', "a harness path"],
    ["export const skills = `kiro-ide/skills`;\n", "a template"],
  ])("refuses %s (%s)", (code) => {
    expect(findingsFor(code, "src/projection/domain/layout.ts")).toContainEqual(
      refusal(HARNESS_NAME),
    );
  });

  test("leaves a word that only starts like a harness name", () => {
    const code = 'export const label = "claudette";\n';

    expect(findingsFor(code, "src/projection/domain/layout.ts")).not.toContainEqual(ANY_REFUSAL);
  });

  test("leaves a domain word that is also a harness name in a list of values", () => {
    const code = 'export const SOURCES = ["switch", "cursor", "stamp"] as const;\n';

    expect(findingsFor(code, "src/execution/domain/session.ts")).not.toContainEqual(ANY_REFUSAL);
  });

  test("leaves sample harness values in fixtures", () => {
    const code = 'export const layout = { claude: ".claude/skills" };\n';

    expect(findingsFor(code, "src/packaging/fixtures/claude-layout.fixture.ts")).not.toContainEqual(
      ANY_REFUSAL,
    );
  });

  test("still refuses branching on a harness name in a test", () => {
    const code = 'export const isClaude = (name: string) => name === "claude";\n';

    expect(findingsFor(code, "src/projection/domain/layout.test.ts")).toContainEqual(
      refusal("Harness branching"),
    );
  });
});

const UNDECODED = "JSON.parse";

describe("boundaryConfig JSON decoding in adapters", () => {
  test("refuses JSON.parse whose result skips a schema", () => {
    const code = "export const read = (text: string): unknown => JSON.parse(text);\n";

    expect(findingsFor(code, "src/execution/adapters/state-file.ts")).toContainEqual(
      refusal(UNDECODED),
    );
  });

  test("accepts JSON.parse fed straight into a schema", () => {
    const code =
      'import { StateSchema } from "./state-schema.ts";\n' +
      "export const read = (text: string) => StateSchema.safeParse(JSON.parse(text));\n";

    expect(findingsFor(code, "src/execution/adapters/state-file.ts")).not.toContainEqual(
      ANY_REFUSAL,
    );
  });

  test("leaves JSON.parse in an adapter test", () => {
    const code = 'export const expected: unknown = JSON.parse("[]");\n';

    expect(findingsFor(code, "src/execution/adapters/state-file.test.ts")).not.toContainEqual(
      ANY_REFUSAL,
    );
  });
});


const FIXTURE_IMPORT =
  'import { accept } from "../../../kernel/fixtures/accept.ts";\nexport const sample = accept;\n';

const IMPORT_REFUSAL = expect.objectContaining({ ruleId: "no-restricted-imports" });

describe("boundaryConfig in host bundles", () => {
  test("lets a host test import kernel fixtures", () => {
    expect(findingsFor(FIXTURE_IMPORT, "src/hosts/claude/projection/agent.test.ts")).not.toContainEqual(
      IMPORT_REFUSAL,
    );
  });

  test("still refuses kernel fixtures in host production code", () => {
    expect(findingsFor(FIXTURE_IMPORT, "src/hosts/claude/projection/agent.ts")).toContainEqual(
      IMPORT_REFUSAL,
    );
  });

  test("lets host production code import a context's ports concept file", () => {
    const code =
      'import type { Rendering } from "../../../projection/application/ports/harness.ts";\n' +
      "export type Sample = Rendering;\n";

    expect(findingsFor(code, "src/hosts/claude/projection/agent.ts")).not.toContainEqual(
      IMPORT_REFUSAL,
    );
  });

  test("still refuses host production code importing a context's use case", () => {
    const code =
      'import { project } from "../../../projection/application/project-runtime.ts";\n' +
      "export const p = project;\n";

    expect(findingsFor(code, "src/hosts/claude/projection/agent.ts")).toContainEqual(IMPORT_REFUSAL);
  });

  test("still refuses a host test reaching into a context's adapters", () => {
    const code = 'import { read } from "../../../projection/adapters/x.ts";\nexport const r = read;\n';

    expect(findingsFor(code, "src/hosts/claude/projection/agent.test.ts")).toContainEqual(
      IMPORT_REFUSAL,
    );
  });
});

describe("boundaryConfig in colocated tests", () => {
  test("lets a domain test import bun:test and its own context's fixtures", () => {
    const messages = new Linter({ configType: "flat" }).verify(
      'import { expect, test } from "bun:test";\n' +
        'import { stage } from "../fixtures/identities.fixture.ts";\n' +
        'test("stage", () => expect(stage).toBeDefined());\n',
      BOUNDARIES,
      { filename: "src/workflow-definition/domain/stage.test.ts" },
    );

    expect(messages).toEqual([]);
  });

  test("still refuses an adapter import in a domain test", () => {
    const messages = new Linter({ configType: "flat" }).verify(
      'import { stageFile } from "../adapters/stage-file.ts";\nexport const file = stageFile;\n',
      BOUNDARIES,
      { filename: "src/workflow-definition/domain/stage.test.ts" },
    );

    expect(messages).toContainEqual(
      expect.objectContaining({ ruleId: "no-restricted-imports", line: 1 }),
    );
  });

  test("lets an adapter test import its own context's fixtures", () => {
    const messages = new Linter({ configType: "flat" }).verify(
      'import { expect, test } from "bun:test";\n' +
        'import { stage } from "../fixtures/identities.fixture.ts";\n' +
        'test("stage", () => expect(stage).toBeDefined());\n',
      BOUNDARIES,
      { filename: "src/workflow-definition/adapters/stage-file.test.ts" },
    );

    expect(messages).toEqual([]);
  });
});

describe("boundaryConfig for registered kernel implementers", () => {
  const FILE_SYSTEM = "src/kernel/file-system.ts";

  test("lets the file-system implementer import its registered modules", () => {
    const code = 'import { readFile } from "node:fs/promises";\nexport const read = readFile;\n';

    expect(findingsFor(code, FILE_SYSTEM)).toEqual([]);
  });

  test("refuses a node module the implementer did not register", () => {
    const code = 'import { spawn } from "node:child_process";\nexport const run = spawn;\n';

    expect(findingsFor(code, FILE_SYSTEM)).toContainEqual(
      expect.objectContaining({ ruleId: "no-restricted-imports", line: 1 }),
    );
  });

  test("refuses a global the implementer did not register", () => {
    const code = "export const open = (): unknown => fetch;\n";

    expect(findingsFor(code, "src/kernel/yaml-parser.ts")).toContainEqual(
      expect.objectContaining({ ruleId: "no-restricted-globals" }),
    );
  });

  test("lets the process runner use Bun, which it registered", () => {
    const code = "export const spawn = Bun.spawn;\n";

    expect(findingsFor(code, "src/kernel/process-runner.ts")).toEqual([]);
  });

  test("refuses a dynamic import in an implementer", () => {
    const code = 'export const load = () => import("node:fs");\n';

    expect(findingsFor(code, FILE_SYSTEM)).toContainEqual(
      expect.objectContaining({ ruleId: "no-restricted-syntax" }),
    );
  });

  test("keeps every other kernel file pure", () => {
    const code = 'import { readFile } from "node:fs/promises";\nexport const read = readFile;\n';

    expect(findingsFor(code, "src/kernel/other.ts")).toContainEqual(
      expect.objectContaining({ ruleId: "no-restricted-imports", line: 1 }),
    );
  });

  test("lets only the hermetic test touch the real disk", () => {
    const code = 'import { mkdtemp } from "node:fs/promises";\nexport const make = mkdtemp;\n';

    expect(findingsFor(code, "src/kernel/file-system.hermetic.test.ts")).toEqual([]);
    expect(findingsFor(code, "src/kernel/file-system.test.ts")).toContainEqual(
      expect.objectContaining({ ruleId: "no-restricted-imports", line: 1 }),
    );
  });
});

const NODE_FS_IMPORT = 'import { readFileSync } from "node:fs";\nexport const read = readFileSync;\n';

const IMPORT_REFUSED = expect.objectContaining({ ruleId: "no-restricted-imports" });

describe("boundaryConfig for roots and the tests of adapters and roots", () => {
  test("refuses a platform import in a context root", () => {
    expect(findingsFor(NODE_FS_IMPORT, "src/execution/main.ts")).toContainEqual(IMPORT_REFUSED);
  });

  test("lets the composition root in src/cli import the platform", () => {
    expect(findingsFor(NODE_FS_IMPORT, "src/cli/main.ts")).not.toContainEqual(IMPORT_REFUSED);
  });

  test("refuses a platform import in an adapter test", () => {
    const messages = findingsFor(NODE_FS_IMPORT, "src/projection/adapters/reader.test.ts");

    expect(messages).toContainEqual(IMPORT_REFUSED);
  });

  test("refuses a platform import in a root test", () => {
    expect(findingsFor(NODE_FS_IMPORT, "src/execution/main.test.ts")).toContainEqual(
      IMPORT_REFUSED,
    );
  });

  test("lets an adapter test import a package that is not the platform", () => {
    const code = 'import { z } from "zod";\nexport const name = z.string();\n';

    const messages = findingsFor(code, "src/projection/adapters/reader.test.ts");

    expect(messages).not.toContainEqual(IMPORT_REFUSED);
  });

  test("lets a registered hermetic test import the platform", () => {
    const hermetic = "src/kernel/file-system.hermetic.test.ts";

    expect(findingsFor(NODE_FS_IMPORT, hermetic)).not.toContainEqual(IMPORT_REFUSED);
  });
});

const TYPE_BRIDGES = [
  {
    module: "core/tools/aidlc-lib.ts",
    readBy: "src/projection/domain/host-surface.ts",
    retiresWhen: "Phase 2: its owner moves into src.",
  },
  {
    module: "core/tools/aidlc-runtime-paths.ts",
    readBy: "src/projection/domain/host-surface.ts",
    retiresWhen: "Phase 2: its owner moves into src.",
  },
];

const SHIPPED = '"../../../core/tools/aidlc-lib.ts"';
const SHIPPED_PATHS = '"../../../core/tools/aidlc-runtime-paths.ts"';

const typeBridgeFindingsFor = (code: string): Linter.LintMessage[] =>
  new Linter({ configType: "flat" }).verify(
    code,
    [...standardsConfig, ...typeBridgeConfigs(TYPE_BRIDGES)],
    { filename: "src/projection/domain/host-surface.ts" },
  );

const TYPE_BRIDGE_REFUSAL = refusal("Type bridge: this file may only import type");

describe("boundaryConfig for a type bridge to a shipped owner", () => {
  test("allows a type import of each bridged module", () => {
    const code =
      `import type { HookActivation } from ${SHIPPED};\n` +
      `import { type KiroLayout } from ${SHIPPED_PATHS};\n` +
      "export type Own = [HookActivation, KiroLayout];\n";

    expect(typeBridgeFindingsFor(code)).not.toContainEqual(TYPE_BRIDGE_REFUSAL);
    expect(typeBridgeFindingsFor(code)).not.toContainEqual(IMPORT_REFUSAL);
  });

  test("allows a type re-export of the bridged module", () => {
    const code = `export type { HookActivation } from ${SHIPPED};\n`;

    expect(typeBridgeFindingsFor(code)).not.toContainEqual(TYPE_BRIDGE_REFUSAL);
    expect(typeBridgeFindingsFor(code)).not.toContainEqual(IMPORT_REFUSAL);
  });

  test("refuses a value import of the bridged module", () => {
    const code = `import { kiroLayoutOf } from ${SHIPPED_PATHS};\nexport const f = kiroLayoutOf;\n`;

    expect(typeBridgeFindingsFor(code)).toContainEqual(TYPE_BRIDGE_REFUSAL);
  });

  test("refuses a side-effect import of the bridged module", () => {
    expect(typeBridgeFindingsFor(`import ${SHIPPED};\nexport const one = 1;\n`)).toContainEqual(
      TYPE_BRIDGE_REFUSAL,
    );
  });

  test("refuses a value re-export of the bridged module", () => {
    expect(typeBridgeFindingsFor(`export { kiroLayoutOf } from ${SHIPPED_PATHS};\n`)).toContainEqual(
      TYPE_BRIDGE_REFUSAL,
    );
  });

  test("refuses an import of a legacy module that is not bridged", () => {
    const code = 'import type { X } from "../../../core/tools/aidlc-init.ts";\nexport type Y = X;\n';

    expect(typeBridgeFindingsFor(code)).toContainEqual(IMPORT_REFUSAL);
  });
});

const SHIPPED_ROW = [
  {
    name: "HookActivation",
    context: "projection",
    kind: "concept",
    definition: "What a host tells the person.",
    shippedOwner: "core/tools/aidlc-lib.ts",
  },
] as const;

const ownershipFindingsFor = (filename: string): Linter.LintMessage[] =>
  new Linter({ configType: "flat" }).verify(
    "export interface HookActivation {}\n",
    [
      ...standardsConfig,
      {
        files: ["**/*.ts"],
        rules: {
          "no-restricted-syntax": ["error", ...legacyOwnership(SHIPPED_ROW, filename)],
        },
      },
    ],
    { filename },
  );

describe("legacyOwnership for a row naming its shipped owner", () => {
  test("allows the exported declaration in the shipped owner's file", () => {
    expect(ownershipFindingsFor("core/tools/aidlc-lib.ts")).not.toContainEqual(ANY_REFUSAL);
  });

  test("still refuses the same declaration in another legacy file", () => {
    expect(ownershipFindingsFor("core/tools/aidlc-init.ts")).toContainEqual(
      refusal("this declares HookActivation again"),
    );
  });
});

const FILE_SYSTEM_BUILT = 'export const files = createNodeFileSystem();\n';

describe("boundaryConfig for building a platform implementer", () => {
  test("refuses a route building the file system", () => {
    expect(
      findingsFor(FILE_SYSTEM_BUILT, "src/cli/adapters/routes/projection/legacy-runner-child.ts"),
    ).toContainEqual(refusal("built once, in a process entry"));
  });

  test("refuses a context root building the process runner", () => {
    expect(
      findingsFor("export const run = createNodeProcessRunner();\n", "src/cli/roots.ts"),
    ).toContainEqual(refusal("built once, in a process entry"));
  });

  test("refuses a route building it through a namespace", () => {
    const code = "export const files = composition.createNodeFileSystem();";

    expect(findingsFor(code, "src/cli/roots.ts")).toContainEqual(
      refusal("built once, in a process entry"),
    );
  });

  test("allows the main entry to build the file system", () => {
    expect(findingsFor(FILE_SYSTEM_BUILT, "src/cli/main.ts")).not.toContainEqual(
      refusal("built once, in a process entry"),
    );
  });

  test("allows the legacy runner child entry to build the file system", () => {
    expect(findingsFor(FILE_SYSTEM_BUILT, "src/cli/legacy-runner-child.ts")).not.toContainEqual(
      refusal("built once, in a process entry"),
    );
  });
});

const USE_CASE_IMPORT =
  'import { plan } from "../../../../projection/application/legacy-command-plan.ts";\n' +
  "export const planned = plan;\n";

const ROOT_USE_CASE_IMPORT =
  'import { plan } from "../projection/application/legacy-command-plan.ts";\n' +
  "export const planned = plan;\n";

const DOMAIN_IMPORT =
  'import { subject } from "../../../../projection/domain/native-command.ts";\n' +
  "export const named = subject;\n";

describe("boundaryConfig for the cli composing other contexts", () => {
  test("refuses a cli route importing another context's use case", () => {
    const messages = findingsFor(
      USE_CASE_IMPORT,
      "src/cli/adapters/routes/projection/legacy-runner-child.ts",
    );

    expect(messages).toContainEqual(expect.objectContaining({ ruleId: "no-restricted-imports" }));
  });

  test("lets a cli composition root import another context's use case", () => {
    expect(findingsFor(ROOT_USE_CASE_IMPORT, "src/cli/main.ts")).not.toContainEqual(
      expect.objectContaining({ ruleId: "no-restricted-imports" }),
    );
  });

  test("lets a cli route import another context's domain", () => {
    const messages = findingsFor(
      DOMAIN_IMPORT,
      "src/cli/adapters/routes/projection/legacy-runner-child.ts",
    );

    expect(messages).not.toContainEqual(
      expect.objectContaining({ ruleId: "no-restricted-imports" }),
    );
  });
});
