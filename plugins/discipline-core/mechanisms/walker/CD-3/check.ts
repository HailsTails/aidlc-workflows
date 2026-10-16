import { z } from "zod";
import type { TypeScriptWalkerCheck } from "../runner/typescript-parse.ts";
import type { LocatedSnippet } from "../runner/walker-check.ts";

const STRICT_FLAGS = [
  "strict",
  "noUncheckedIndexedAccess",
  "exactOptionalPropertyTypes",
  "noImplicitOverride",
  "noFallthroughCasesInSwitch",
  "noPropertyAccessFromIndexSignature",
  "useUnknownInCatchVariables",
] as const;

const configSchema = z.object({ compilerOptions: z.record(z.string(), z.unknown()).optional() });

export const check: TypeScriptWalkerCheck = {
  kind: "repository",
  inspect: ({ repository }) => {
    const findings: LocatedSnippet[] = [];
    for (const file of repository.files.filter(
      (path) => path.split("/").at(-1) === "tsconfig.json",
    )) {
      const content = repository.readText({ file });
      if (content.outcome === "failed") return content;
      const parsed: unknown = repository.syntaxApi.parseConfigFileTextToJson(
        file,
        content.value,
      ).config;
      const config = configSchema.safeParse(parsed);
      if (!config.success || config.data.compilerOptions === undefined) continue;
      const options = config.data.compilerOptions;
      for (const flag of STRICT_FLAGS.filter((name) => name in options)) {
        findings.push({
          file,
          anchor: { line: 1, column: 0 },
          snippet: `compilerOptions.${flag} = ${JSON.stringify(options[flag])}`,
        });
      }
    }
    return { outcome: "ok", value: findings };
  },
};
