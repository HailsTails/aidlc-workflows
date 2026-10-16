import type { Statement, SyntaxKind } from "typescript";
import type { SyntaxApi, TypeScriptWalkerCheck } from "../runner/typescript-parse.ts";
import type { LocatedSnippet } from "../runner/walker-check.ts";

const TEST_SUFFIXES = [".test.ts", ".test.tsx", ".integration.test.ts"] as const;
const COMPOSITION_ROOTS = ["App.tsx", "main.tsx"] as const;

const carriesRuntime = ({
  statement,
  syntaxApi,
}: {
  readonly statement: Statement;
  readonly syntaxApi: SyntaxApi;
}): boolean => {
  const modifiers = syntaxApi.canHaveModifiers(statement)
    ? (syntaxApi.getModifiers(statement) ?? [])
    : [];
  const runtimeKinds: readonly SyntaxKind[] = [
    syntaxApi.SyntaxKind.VariableStatement,
    syntaxApi.SyntaxKind.FunctionDeclaration,
    syntaxApi.SyntaxKind.ClassDeclaration,
    syntaxApi.SyntaxKind.EnumDeclaration,
  ];
  return (
    syntaxApi.isExportAssignment(statement) ||
    (runtimeKinds.includes(statement.kind) &&
      modifiers.some((modifier) => modifier.kind === syntaxApi.SyntaxKind.ExportKeyword) &&
      !modifiers.some((modifier) => modifier.kind === syntaxApi.SyntaxKind.DeclareKeyword)) ||
    (syntaxApi.isExportDeclaration(statement) &&
      !statement.isTypeOnly &&
      statement.exportClause !== undefined &&
      syntaxApi.isNamedExports(statement.exportClause) &&
      statement.exportClause.elements.some((specifier) => !specifier.isTypeOnly))
  );
};

export const check: TypeScriptWalkerCheck = {
  kind: "repository",
  inspect: ({ repository }) => {
    const findings: LocatedSnippet[] = [];
    const files: ReadonlySet<string> = new Set(repository.files);
    for (const file of repository.files) {
      if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
      if (
        TEST_SUFFIXES.some((suffix) => file.endsWith(suffix)) ||
        file.endsWith(".d.ts") ||
        file.split("/").includes("__tests__") ||
        COMPOSITION_ROOTS.some((name) => file.split("/").at(-1) === name)
      )
        continue;
      const parsed = repository.parseFile({ file });
      if (parsed.outcome === "failed") return parsed;
      if (
        !parsed.value.tree.statements.some((statement) =>
          carriesRuntime({ statement, syntaxApi: repository.syntaxApi }),
        )
      )
        continue;
      const sibling = file.endsWith(".tsx")
        ? file.replace(/\.tsx$/, ".test.tsx")
        : file.replace(/\.ts$/, ".test.ts");
      if (files.has(sibling)) continue;
      findings.push({
        file,
        anchor: { line: 1, column: 0 },
        snippet: "missing co-located *.test.ts(x) sibling",
      });
    }
    return { outcome: "ok", value: findings };
  },
};
