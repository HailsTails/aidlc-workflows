import { describe, expect, test } from "bun:test";
import { typescriptModuleReader } from "../adapters/typescript-module-reader.ts";
import type { NameList, Workspace } from "./ports.ts";
import { isolationCheck } from "./isolation-check.ts";
import type { GateScope } from "./gate-scope.ts";

const FILES: Readonly<Record<string, string>> = {
  "src/a/domain/rules.ts": "export const rule = 1;",
  "src/a/domain/rules.test.ts": 'import { rule } from "./rules.ts";\nexport const t = rule;',
};

const workspaceWith = (files: Readonly<Record<string, string>>): Workspace => ({
  read: (path) => files[path],
  write: () => undefined,
  filesMatching: () => Object.keys(files),
});

const recordOf = (names: readonly string[] | undefined): NameList => ({
  read: () => names,
  write: () => undefined,
});

const SCOPE = { record: false } as unknown as GateScope;

const outcomeFor = (request: {
  readonly files: Readonly<Record<string, string>>;
  readonly recorded: readonly string[] | undefined;
}) =>
  isolationCheck({
    workspace: workspaceWith(request.files),
    modules: typescriptModuleReader,
    record: recordOf(request.recorded),
    implementers: () => [],
    sources: ["src/**/*.ts"],
  }).run(SCOPE);

describe("isolationCheck", () => {
  test("pure code and an empty record are green", async () => {
    const outcome = await outcomeFor({ files: FILES, recorded: [] });

    expect(outcome.status).toBe("green");
  });

  test("red probe: a new file that uses Bun is red with the offender named", async () => {
    const files = { ...FILES, "src/a/application/run.ts": "export const go = Bun.spawn;" };

    const outcome = await outcomeFor({ files, recorded: [] });

    expect(outcome.status).toBe("red");
    expect(outcome.findings[0]?.subject).toBe("src/a/application/run.ts · uses Bun");
  });

  test("the same offender already in the record is green", async () => {
    const files = { ...FILES, "src/a/application/run.ts": "export const go = Bun.spawn;" };

    const outcome = await outcomeFor({ files, recorded: ["src/a/application/run.ts · uses Bun"] });

    expect(outcome.status).toBe("green");
  });

  test("a missing record is red and says how to make one", async () => {
    const outcome = await outcomeFor({ files: FILES, recorded: undefined });

    expect(outcome.status).toBe("red");
    expect(outcome.findings[0]?.fix).toContain("--only isolation --record");
  });
});
