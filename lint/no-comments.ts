import type { Rule } from "./eslint-port.ts";

const ALLOWED = /^\s*(?:eslint-|@ts-expect-error|biome-ignore|TODO\(#\d+\))/;

export const noComments: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    messages: {
      comment:
        "No comments: rename or retype the code so it says this itself. Only tool " +
        "directives and TODO(#issue) pointers are allowed.",
    },
    schema: [],
  },
  create: (context) => ({
    Program: () => {
      context.sourceCode
        .getAllComments()
        .filter((comment) => !ALLOWED.test(comment.value))
        .forEach((comment) => {
          if (comment.loc) {
            context.report({ loc: comment.loc, messageId: "comment" });
          }
        });
    },
  }),
};
