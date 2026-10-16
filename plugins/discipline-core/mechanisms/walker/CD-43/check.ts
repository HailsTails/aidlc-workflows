import type ts from "typescript";
import { inspectParsedFiles, sourceSnippet } from "../runner/legacy-source.ts";
import type { LocatedSnippet } from "../runner/walker-check.ts";
import type { TypeScriptWalkerCheck } from "../runner/typescript-parse.ts";

export const check: TypeScriptWalkerCheck = {
  kind: "repository",
  inspect: ({ repository }) => inspectParsedFiles({
    repository,
    inspect: ({ file, parsed, syntaxApi: ts }) => {
      const isNullishLikeTypeNode = (memberType: ts.TypeNode): boolean => {
        if (memberType.kind === ts.SyntaxKind.UndefinedKeyword) {
          return true;
        }
        if (
          ts.isLiteralTypeNode(memberType) &&
          memberType.literal.kind === ts.SyntaxKind.NullKeyword
        ) {
          return true;
        }
        return false;
      };

      const isBooleanLikeTypeNode = (typeNode: ts.TypeNode): boolean => {
        if (typeNode.kind === ts.SyntaxKind.BooleanKeyword) {
          return true;
        }
        if (!ts.isUnionTypeNode(typeNode)) {
          return false;
        }
        const hasBooleanMember = typeNode.types.some(
          (memberType) => memberType.kind === ts.SyntaxKind.BooleanKeyword,
        );
        if (!hasBooleanMember) {
          return false;
        }
        return typeNode.types.every(
          (memberType) =>
            memberType.kind === ts.SyntaxKind.BooleanKeyword ||
            isNullishLikeTypeNode(memberType),
        );
      };

      const isFunctionLikeWithReturnType = (
        node: ts.Node,
      ): node is ts.SignatureDeclaration => {
        if (
          !(
            ts.isFunctionDeclaration(node) ||
            ts.isFunctionExpression(node) ||
            ts.isArrowFunction(node) ||
            ts.isMethodDeclaration(node) ||
            ts.isMethodSignature(node) ||
            ts.isFunctionTypeNode(node) ||
            ts.isConstructorTypeNode(node) ||
            ts.isCallSignatureDeclaration(node) ||
            ts.isConstructSignatureDeclaration(node) ||
            ts.isGetAccessorDeclaration(node) ||
            ts.isIndexSignatureDeclaration(node)
          )
        ) {
          return false;
        }
        return node.type !== undefined;
      };

      const isAuthoredBooleanReturnType = (
        node: ts.SignatureDeclaration,
      ): boolean => {
        if (node.type === undefined) {
          return false;
        }
        if (ts.isTypePredicateNode(node.type)) {
          return false;
        }
        return isBooleanLikeTypeNode(node.type);
      };

      return parsed.nodes.flatMap((node) => {
        const findings: LocatedSnippet[] = [];
        if (ts.isParameter(node) && node.type !== undefined && isBooleanLikeTypeNode(node.type)) {
          findings.push(sourceSnippet({ file, tree: parsed.tree, node }));
        }
        if (ts.isPropertySignature(node) && node.type !== undefined && isBooleanLikeTypeNode(node.type)) {
          findings.push(sourceSnippet({ file, tree: parsed.tree, node }));
        }
        if (isFunctionLikeWithReturnType(node) && isAuthoredBooleanReturnType(node)) {
          findings.push(sourceSnippet({ file, tree: parsed.tree, node }));
        }
        return findings;
      });
    },
  }),
};
