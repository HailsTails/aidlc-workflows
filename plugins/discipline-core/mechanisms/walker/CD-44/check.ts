import type ts from "typescript";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import { inspectParsedFiles, sourceSnippet } from "../runner/legacy-source.ts";
import type { LocatedSnippet } from "../runner/walker-check.ts";
import type { TypeScriptWalkerCheck } from "../runner/typescript-parse.ts";

export const check: TypeScriptWalkerCheck = {
  kind: "repository",
  inspect: ({ repository }) => inspectParsedFiles({
    repository,
    inspect: ({ file, parsed, syntaxApi: ts }) => {
      const extractBindingIdentifierNames = (
        binding: ts.BindingName,
      ): readonly string[] => {
        if (ts.isIdentifier(binding)) {
          return [binding.text];
        }
        if (ts.isObjectBindingPattern(binding) || ts.isArrayBindingPattern(binding)) {
          return binding.elements.flatMap((element) => {
            if (ts.isOmittedExpression(element)) {
              return [];
            }
            return extractBindingIdentifierNames(element.name);
          });
        }
        return [];
      };

      const collectParamNames = (
        functionLike: ts.SignatureDeclaration,
      ): ReadonlySet<string> => {
        const collected: string[] = [];
        functionLike.parameters.forEach((parameterNode) => {
          collected.push(...extractBindingIdentifierNames(parameterNode.name));
        });
        return new Set(collected);
      };

      const isFunctionLike = (node: ts.Node): node is ts.SignatureDeclaration =>
        ts.isFunctionDeclaration(node) ||
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node) ||
        ts.isMethodDeclaration(node);

      const leftmostIdentifierOfAccessChain = (
        expression: ts.Expression,
      ): string | undefined => {
        if (ts.isPropertyAccessExpression(expression)) {
          return leftmostIdentifierOfAccessChain(expression.expression);
        }
        if (ts.isElementAccessExpression(expression)) {
          return leftmostIdentifierOfAccessChain(expression.expression);
        }
        if (ts.isIdentifier(expression)) {
          return expression.text;
        }
        return undefined;
      };

      const isInAnyScope = (
        scopeStack: readonly ReadonlySet<string>[],
        name: string,
      ): boolean => scopeStack.some((scope) => scope.has(name));

      const isAccessChainAssignment = (node: ts.Node): node is ts.BinaryExpression =>
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        (ts.isPropertyAccessExpression(node.left) ||
          ts.isElementAccessExpression(node.left));

      const isDeleteOnAccessChain = (node: ts.Node): node is ts.DeleteExpression => {
        if (!ts.isDeleteExpression(node)) {
          return false;
        }
        return (
          ts.isPropertyAccessExpression(node.expression) ||
          ts.isElementAccessExpression(node.expression)
        );
      };

      const MUTATING_METHOD_NAMES: readonly string[] = [
        "push",
        "pop",
        "shift",
        "unshift",
        "splice",
        "sort",
        "reverse",
        "fill",
        "copyWithin",
      ];

      const mutatingMethodNameOf = (
        callExpression: ts.CallExpression,
      ): string | undefined => {
        if (!ts.isPropertyAccessExpression(callExpression.expression)) {
          return undefined;
        }
        const methodName = callExpression.expression.name.text;
        if (!MUTATING_METHOD_NAMES.includes(methodName)) {
          return undefined;
        }
        return methodName;
      };

      const isMutatingMethodCall = (node: ts.Node): node is ts.CallExpression => {
        if (!ts.isCallExpression(node)) {
          return false;
        }
        if (!ts.isPropertyAccessExpression(node.expression)) {
          return false;
        }
        return mutatingMethodNameOf(node) !== undefined;
      };

      type WalkerContext = {
        readonly file: RepoPath;
        readonly sourceFile: ts.SourceFile;
        readonly paramScopeStack: readonly ReadonlySet<string>[];
        readonly accumulated: LocatedSnippet[];
      };

      const checkFieldMutationAt = ({
        context,
        node,
        accessTarget,
      }: {
        readonly context: WalkerContext;
        readonly node: ts.Node;
        readonly accessTarget: ts.Expression;
      }): void => {
        const rootName = leftmostIdentifierOfAccessChain(accessTarget);
        if (rootName === undefined) {
          return;
        }
        if (!isInAnyScope(context.paramScopeStack, rootName)) {
          return;
        }
        context.accumulated.push(
          sourceSnippet({ file: context.file, tree: context.sourceFile, node }),
        );
      };

      const checkMethodMutationAt = ({
        context,
        callExpression,
      }: {
        readonly context: WalkerContext;
        readonly callExpression: ts.CallExpression;
      }): void => {
        const methodName = mutatingMethodNameOf(callExpression);
        if (methodName === undefined) {
          return;
        }
        if (!ts.isPropertyAccessExpression(callExpression.expression)) {
          return;
        }
        const rootName = leftmostIdentifierOfAccessChain(
          callExpression.expression.expression,
        );
        if (rootName === undefined) {
          return;
        }
        if (!isInAnyScope(context.paramScopeStack, rootName)) {
          return;
        }
        context.accumulated.push(
          sourceSnippet({ file: context.file, tree: context.sourceFile, node: callExpression }),
        );
      };

      const scopes = new WeakMap<ts.Node, readonly ReadonlySet<string>[]>();
      const parameterScopesOf = (node: ts.Node): readonly ReadonlySet<string>[] => {
        const cached = scopes.get(node);
        if (cached !== undefined) {
          return cached;
        }
        const enclosing = ts.isSourceFile(node) ? [] : parameterScopesOf(node.parent);
        const active = isFunctionLike(node) ? [...enclosing, collectParamNames(node)] : enclosing;
        scopes.set(node, active);
        return active;
      };
      const accumulated: LocatedSnippet[] = [];
      parsed.nodes.forEach((node) => {
        const context: WalkerContext = {
          file,
          sourceFile: parsed.tree,
          paramScopeStack: parameterScopesOf(node),
          accumulated,
        };
        if (isAccessChainAssignment(node)) {
          checkFieldMutationAt({ context, node, accessTarget: node.left });
        }
        if (isDeleteOnAccessChain(node)) {
          checkFieldMutationAt({ context, node, accessTarget: node.expression });
        }
        if (isMutatingMethodCall(node)) {
          checkMethodMutationAt({ context, callExpression: node });
        }
      });
      return accumulated;
    },
  }),
};
