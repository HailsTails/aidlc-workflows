import type { Finding } from "../domain/outcome.ts";
import type { Command, CommandRunner } from "./ports.ts";

export type SharedBuild = {
  readonly ensure: () => Finding | undefined;
};

const failureOf = (command: Command, output: string): Finding => ({
  subject: command.label,
  violation: `failed: ${output.trim().split(/\r?\n/).slice(-3).join(" / ")}`,
  fix: "Make the build pass first; goldens and the legacy suites compare only a complete build.",
});

export const sharedBuild = (runner: CommandRunner, command: Command): SharedBuild => {
  let built: { readonly finding: Finding | undefined } | undefined;
  return {
    ensure: () => {
      if (built === undefined) {
        const result = runner.capture(command);
        built = { finding: result.exitCode === 0 ? undefined : failureOf(command, result.output) };
      }
      return built.finding;
    },
  };
};
