import type { SharedBuild } from "./shared-build.ts";
import type { Command } from "./ports.ts";
import type { TypecheckProject } from "./typecheck-check.ts";

export type TypecheckCommands = {
  readonly tsc: (project: string) => Command;
  readonly shippedTypes: Command;
};

export const typecheckProjects = (
  commands: TypecheckCommands,
  packageBuild: SharedBuild,
): readonly TypecheckProject[] => [
  { command: commands.shippedTypes, triggers: ["src/**", "core/**/*.ts"] },
  { command: commands.tsc("src/tsconfig.json"), triggers: ["src/**"] },
  {
    command: commands.tsc("lint/tsconfig.json"),
    triggers: ["lint/**", "eslint.config.ts", "scripts/gate.ts", "src/glossary.json"],
  },
  {
    command: commands.tsc("tsconfig.json"),
    triggers: [
      "core/**/*.ts",
      "harness/**",
      "scripts/**",
      "plugins/*/tools/**",
      "tsconfig.json",
    ],
    build: packageBuild,
  },
];
