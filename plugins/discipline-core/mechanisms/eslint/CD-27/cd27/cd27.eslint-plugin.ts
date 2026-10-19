import type { AST, Rule } from "../../runner/eslint-instance.ts";

type CalleeNode = {
  readonly type: string;
  readonly name?: string;
  readonly value?: unknown;
  readonly object?: CalleeNode;
  readonly property?: CalleeNode;
  readonly loc?: AST.SourceLocation | null;
};

type CalleeLink = { readonly name: string; readonly node: CalleeNode };

type CalleeChain = { readonly root: CalleeLink; readonly members: readonly CalleeLink[] };

type TestModifier = {
  readonly bareNames: ReadonlySet<string>;
  readonly roots: ReadonlySet<string>;
  readonly members: ReadonlySet<string>;
};

const TEST_ROOTS: ReadonlySet<string> = new Set(["describe", "it", "test", "suite"]);

const FOCUSED: TestModifier = {
  bareNames: new Set(["fdescribe", "fit", "ftest", "fsuite"]),
  roots: TEST_ROOTS,
  members: new Set(["only"]),
};

const SKIPPED: TestModifier = {
  bareNames: new Set(["xdescribe", "xit", "xtest", "xsuite"]),
  roots: TEST_ROOTS,
  members: new Set(["skip", "fixme"]),
};

const memberName = (request: { readonly property: CalleeNode | undefined }): string | undefined => {
  if (request.property?.type === "Identifier") {
    return request.property.name;
  }
  return typeof request.property?.value === "string" ? request.property.value : undefined;
};

const calleeChainOf = (request: {
  readonly callee: CalleeNode;
  readonly members: readonly CalleeLink[];
}): CalleeChain | undefined => {
  if (request.callee.type === "Identifier" && request.callee.name !== undefined) {
    return { root: { name: request.callee.name, node: request.callee }, members: request.members };
  }
  if (request.callee.type !== "MemberExpression" || request.callee.object === undefined) {
    return undefined;
  }
  const name = memberName({ property: request.callee.property });
  if (name === undefined || request.callee.property === undefined) {
    return undefined;
  }
  return calleeChainOf({
    callee: request.callee.object,
    members: [{ name, node: request.callee.property }, ...request.members],
  });
};

const modifiedLink = (request: {
  readonly callee: CalleeNode;
  readonly modifier: TestModifier;
}): CalleeLink | undefined => {
  const chain = calleeChainOf({ callee: request.callee, members: [] });
  if (chain === undefined) {
    return undefined;
  }
  if (chain.members.length === 0) {
    return request.modifier.bareNames.has(chain.root.name) ? chain.root : undefined;
  }
  return request.modifier.roots.has(chain.root.name)
    ? chain.members.find((link) => request.modifier.members.has(link.name))
    : undefined;
};

const modifierRule = (request: {
  readonly modifier: TestModifier;
  readonly description: string;
  readonly message: string;
}): Rule.RuleModule => ({
  meta: {
    type: "problem",
    docs: { description: request.description },
    schema: [],
    messages: { modifiedTest: request.message },
  },
  create: (context) => ({
    CallExpression: (node) => {
      const loc = modifiedLink({ callee: node.callee, modifier: request.modifier })?.node.loc;
      if (loc === undefined || loc === null) {
        return;
      }
      context.report({ loc, messageId: "modifiedTest" });
    },
  }),
});

export default {
  meta: { name: "discipline-cd27", version: "0.0.0-local" },
  rules: {
    "focused-tests": modifierRule({
      modifier: FOCUSED,
      description: "Disallow focused tests (CD-27)",
      message: "CD-27: remove the focus so every test runs.",
    }),
    "skipped-tests": modifierRule({
      modifier: SKIPPED,
      description: "Disallow skipped tests (CD-27)",
      message: "CD-27: remove the skip so the test runs, or delete the test.",
    }),
  },
};
