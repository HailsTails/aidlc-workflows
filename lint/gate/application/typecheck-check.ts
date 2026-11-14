import { judged, skipped, type Finding } from "../domain/outcome.ts";
import type { GateCheck } from "./gate-check.ts";
import { touches } from "./gate-scope.ts";
import type { Command, CommandRunner } from "./ports.ts";
import type { SharedBuild } from "./shared-build.ts";

export type TypecheckProject = {
  readonly command: Command;
  readonly triggers: readonly string[];
  readonly build?: SharedBuild;
};

export type TypecheckDependencies = {
  readonly runner: CommandRunner;
  readonly projects: readonly TypecheckProject[];
};

const TYPE_ERROR = /error TS\d+:/;

const STRICT_FIX =
  "Fix the type, never silence it: use the official type of the value, narrow unknown " +
  "with a Zod schema at the edge, and avoid casts and non-null assertions.";

const typeErrors = (runner: CommandRunner, project: TypecheckProject): readonly Finding[] => {
  const buildFailure = project.build?.ensure();
  if (buildFailure !== undefined) {
    return [buildFailure];
  }
  const result = runner.capture(project.command);
  const errors = result.output.split(/\r?\n/).filter((line) => TYPE_ERROR.test(line));
  const failedWithoutErrors = result.exitCode !== 0 && errors.length === 0;
  const lines = failedWithoutErrors ? [result.output.trim().split(/\r?\n/).at(-1) ?? ""] : errors;
  return lines.map((line) => ({
    subject: project.command.label,
    violation: line.trim(),
    fix: STRICT_FIX,
  }));
};

export const typecheckCheck = (dependencies: TypecheckDependencies): GateCheck => ({
  id: "typecheck",
  run: async (scope) => {
    const due = dependencies.projects.filter(
      (project) => scope.everything || touches(scope, project.triggers),
    );
    if (due.length === 0) {
      return skipped("typecheck", "no typed project changed");
    }
    const findings = due.flatMap((project) => typeErrors(dependencies.runner, project));
    const note = due.map((project) => project.command.label).join(", ");
    return judged({ id: "typecheck", findings, note });
  },
});
