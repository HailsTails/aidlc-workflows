import type ts from "typescript";
import { inspectParsedFiles, sourceSnippet, type TypeScriptRepository } from "./legacy-source.ts";

export const castFindings = (request: { readonly repository: TypeScriptRepository }) =>
  inspectParsedFiles({
    repository: request.repository,
    inspect: ({ file, parsed, syntaxApi: ts }) => {
      const isUnknownTypeNode = (typeNode: ts.TypeNode): boolean =>
        typeNode.kind === ts.SyntaxKind.UnknownKeyword;
      
      const isConstAssertionTypeNode = (typeNode: ts.TypeNode): boolean => {
        if (!ts.isTypeReferenceNode(typeNode)) {
          return false;
        }
        if (!ts.isIdentifier(typeNode.typeName)) {
          return false;
        }
        return typeNode.typeName.text === "const";
      };
      
      const ZOD_MODULE_SPECIFIER_PATTERN = /^zod(\/.*)?$/;
      
      const namesImportedFromZod = (
        sourceFile: ts.SourceFile,
      ): ReadonlySet<string> => {
        const imported = new Set<string>();
        sourceFile.statements.forEach((statement) => {
          if (!ts.isImportDeclaration(statement)) {
            return;
          }
          if (!ts.isStringLiteral(statement.moduleSpecifier)) {
            return;
          }
          if (!ZOD_MODULE_SPECIFIER_PATTERN.test(statement.moduleSpecifier.text)) {
            return;
          }
          const namedBindings = statement.importClause?.namedBindings;
          if (namedBindings === undefined || !ts.isNamedImports(namedBindings)) {
            return;
          }
          namedBindings.elements.forEach((element) => {
            imported.add(element.name.text);
          });
        });
        return imported;
      };
      
      const isZodIntrospectionTypeNode = ({
        typeNode,
        zodImportedNames,
      }: {
        readonly typeNode: ts.TypeNode;
        readonly zodImportedNames: ReadonlySet<string>;
      }): boolean => {
        if (!ts.isTypeReferenceNode(typeNode)) {
          return false;
        }
        if (!ts.isIdentifier(typeNode.typeName)) {
          return false;
        }
        return zodImportedNames.has(typeNode.typeName.text);
      };
      
      const isToolInputSchemaTypeNode = (typeNode: ts.TypeNode): boolean => {
        if (!ts.isIndexedAccessTypeNode(typeNode)) {
          return false;
        }
        const objectType = typeNode.objectType;
        if (!ts.isTypeReferenceNode(objectType)) {
          return false;
        }
        if (!ts.isIdentifier(objectType.typeName)) {
          return false;
        }
        if (objectType.typeName.text !== "Tool") {
          return false;
        }
        const indexType = typeNode.indexType;
        if (!ts.isLiteralTypeNode(indexType)) {
          return false;
        }
        if (!ts.isStringLiteral(indexType.literal)) {
          return false;
        }
        return indexType.literal.text === "inputSchema";
      };
      
      const isSqliteRowArrayCast = ({
        expression,
        typeNode,
      }: {
        readonly expression: ts.Expression;
        readonly typeNode: ts.TypeNode;
      }): boolean => {
        if (!ts.isPropertyAccessExpression(expression)) {
          return false;
        }
        if (expression.name.text !== "value") {
          return false;
        }
        if (!ts.isTypeReferenceNode(typeNode)) {
          return false;
        }
        if (!ts.isIdentifier(typeNode.typeName)) {
          return false;
        }
        const typeName = typeNode.typeName.text;
        return typeName === "ReadonlyArray" || typeName === "Array";
      };
      
      const isPermittedAsExpression = ({
        node,
        zodImportedNames,
      }: {
        readonly node: ts.AsExpression;
        readonly zodImportedNames: ReadonlySet<string>;
      }): boolean => {
        const typeNode = node.type;
        if (isUnknownTypeNode(typeNode)) {
          return true;
        }
        if (isConstAssertionTypeNode(typeNode)) {
          return true;
        }
        if (isZodIntrospectionTypeNode({ typeNode, zodImportedNames })) {
          return true;
        }
        if (isToolInputSchemaTypeNode(typeNode)) {
          return true;
        }
        if (isSqliteRowArrayCast({ expression: node.expression, typeNode })) {
          return true;
        }
        return false;
      };
      
      const zodImportedNames = namesImportedFromZod(parsed.tree);
      return parsed.nodes.flatMap((node) =>
        ((ts.isAsExpression(node) && !isPermittedAsExpression({ node, zodImportedNames })) ||
          ts.isTypeAssertionExpression(node))
          ? [sourceSnippet({ file, tree: parsed.tree, node })]
          : [],
      );
    },
  });
