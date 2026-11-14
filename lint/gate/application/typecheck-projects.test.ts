import { describe, expect, test } from "bun:test";
import type { Finding } from "../domain/outcome.ts";
import type { GateScope } from "./gate-scope.ts";
import type { Command, CommandRunner } from "./ports.ts";
import type { SharedBuild } from "./shared-build.ts";
import { typecheckCheck } from "./typecheck-check.ts";
import { typecheckProjects } from "./typecheck-projects.ts";

const HARNESS_FILE = "harness/kiro/manifest.ts";

const ROOT_PROJECT = "tsc -p tsconfig.json";

const MISSING_DIST: Finding = {
  subject: "bun scripts/package.ts",
  violation: "failed: no dist",
  fix: "Make the build pass first.",
};

const command = (label: string): Command => ({ label, argv: [label] });

const scopeChanging = (...paths: string[]): GateScope =>
  ({
    everything: false,
    changes: paths.map((path) => ({ path, kind: "modified" })),
  }) as unknown as GateScope;

type Session = {
  readonly ran: string[];
  readonly built: string[];
  readonly judge: (scope: GateScope) => ReturnType<ReturnType<typeof typecheckCheck>["run"]>;
};

const session = (build: Finding | undefined, tscOutput = ""): Session => {
  const ran: string[] = [];
  const built: string[] = [];
  const packageBuild: SharedBuild = {
    ensure: () => {
      built.push("package");
      return build;
    },
  };
  const runner = {
    capture: (run: Command) => {
      ran.push(run.label);
      return { exitCode: tscOutput === "" ? 0 : 2, output: tscOutput };
    },
  } as unknown as CommandRunner;
  const projects = typecheckProjects(
    { tsc: (project) => command(`tsc -p ${project}`), shippedTypes: command("tsc -b shipped") },
    packageBuild,
  );
  return { ran, built, judge: (scope) => typecheckCheck({ runner, projects }).run(scope) };
};

describe("typecheck project selection", () => {
  test.each([
    "harness/kiro/manifest.ts",
    "harness/codex/skills/aidlc/SKILL.md",
    "core/tools/aidlc-lib.ts",
    "scripts/package.ts",
    "plugins/test-pro/tools/probe.ts",
    "tsconfig.json",
  ])("a change to %s selects the root project", async (path) => {
    const run = session(undefined);

    await run.judge(scopeChanging(path));

    expect(run.ran).toContain(ROOT_PROJECT);
  });

  test("a change only under src leaves the root project alone", async () => {
    const run = session(undefined);

    await run.judge(scopeChanging("src/kernel/values.ts"));

    expect(run.ran).not.toContain(ROOT_PROJECT);
    expect(run.built).toEqual([]);
  });
});

describe("a type error under harness", () => {
  const ERROR = "harness/kiro/manifest.ts(1,14): error TS2322: Type 'string' is not assignable.";

  test("turns the check red", async () => {
    const run = session(undefined, ERROR);

    const outcome = await run.judge(scopeChanging(HARNESS_FILE));

    expect(outcome.status).toBe("red");
    expect(outcome.findings.map((finding) => finding.violation)).toEqual([ERROR]);
  });
});

describe("the root project needs the package build", () => {
  test("it is built before the project is checked", async () => {
    const run = session(undefined);

    await run.judge(scopeChanging("harness/kiro/manifest.ts"));

    expect(run.built).toEqual(["package"]);
  });

  test("a failed build is the finding, and nothing is checked on missing inputs", async () => {
    const run = session(MISSING_DIST);

    const outcome = await run.judge(scopeChanging("harness/kiro/manifest.ts"));

    expect(outcome.findings).toEqual([MISSING_DIST]);
    expect(run.ran).not.toContain(ROOT_PROJECT);
  });
});
