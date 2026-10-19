import type { Rule } from "../../runner/eslint-instance.ts";

type IfNode = Parameters<NonNullable<Rule.RuleListener["IfStatement"]>>[0];

type StatementNode = IfNode["consequent"];

type ExitDisposition = "exits" | "continues";

type BreakReach = "break-exits" | "break-stays-in-switch";

const bothBranchesExit = (request: {
  readonly consequent: StatementNode;
  readonly alternate: StatementNode | null | undefined;
  readonly reach: BreakReach;
}): ExitDisposition => {
  if (request.alternate === null || request.alternate === undefined) {
    return "continues";
  }
  return exitDisposition({ statement: request.consequent, reach: request.reach }) === "exits" &&
    exitDisposition({ statement: request.alternate, reach: request.reach }) === "exits"
    ? "exits"
    : "continues";
};

const everyCaseExits = (request: {
  readonly cases: readonly { readonly consequent: readonly StatementNode[] }[];
}): ExitDisposition => {
  const enteredCases = request.cases.filter((switchCase) => switchCase.consequent.length > 0);
  return enteredCases.length > 0 &&
    enteredCases.every(
      (switchCase) =>
        exitDisposition({ statement: switchCase.consequent.at(-1), reach: "break-stays-in-switch" }) === "exits",
    )
    ? "exits"
    : "continues";
};

const exitDisposition = (request: {
  readonly statement: StatementNode | undefined;
  readonly reach: BreakReach;
}): ExitDisposition => {
  const statement = request.statement;
  if (statement === undefined) {
    return "continues";
  }
  if (
    statement.type === "ReturnStatement" ||
    statement.type === "ThrowStatement" ||
    statement.type === "ContinueStatement"
  ) {
    return "exits";
  }
  if (statement.type === "BreakStatement") {
    return request.reach === "break-exits" ? "exits" : "continues";
  }
  if (statement.type === "BlockStatement") {
    return exitDisposition({ statement: statement.body.at(-1), reach: request.reach });
  }
  if (statement.type === "IfStatement") {
    return bothBranchesExit({ consequent: statement.consequent, alternate: statement.alternate, reach: request.reach });
  }
  return statement.type === "SwitchStatement" ? everyCaseExits({ cases: statement.cases }) : "continues";
};

const chainPosition = (request: { readonly node: IfNode }): "chain-head" | "else-if" =>
  request.node.parent.type === "IfStatement" && request.node.parent.alternate === request.node ? "else-if" : "chain-head";

const reportedElses = (request: {
  readonly consequent: StatementNode;
  readonly alternate: StatementNode | null | undefined;
}): readonly StatementNode[] => {
  if (request.alternate === null || request.alternate === undefined) {
    return [];
  }
  if (exitDisposition({ statement: request.consequent, reach: "break-exits" }) === "continues") {
    return [];
  }
  return request.alternate.type === "IfStatement"
    ? [request.alternate, ...reportedElses({ consequent: request.alternate.consequent, alternate: request.alternate.alternate })]
    : [request.alternate];
};

const uselessElse: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow else after a branch that always exits (CD-42)" },
    schema: [],
    messages: {
      uselessElse: "CD-42: the branch above always exits, so drop this else and return the happy path last.",
    },
  },
  create: (context) => ({
    IfStatement: (node) => {
      if (chainPosition({ node }) === "else-if") {
        return;
      }
      reportedElses({ consequent: node.consequent, alternate: node.alternate }).forEach((alternate) => {
        const elseKeyword = context.sourceCode.getTokenBefore(alternate);
        if (elseKeyword === null) {
          return;
        }
        context.report({ loc: elseKeyword.loc, messageId: "uselessElse" });
      });
    },
  }),
};

export default {
  meta: { name: "discipline-cd42", version: "0.0.0-local" },
  rules: { "useless-else": uselessElse },
};
