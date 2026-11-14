const STANDARD_FIXES: Readonly<Record<string, string>> = {
  "aidlc/no-comments":
    "Delete the comment and make the code say it: a clearer name, a narrower type or a " +
    "Zod schema. Only tool directives and TODO(#issue) pointers stay.",
  "no-nested-ternary":
    "Replace the nested ternary with a named function, a lookup table or early returns.",
  "max-len": "Split the line: name the intermediate value instead of chaining on one line.",
  "max-params":
    "Pass one object parameter with named fields, or split the function by responsibility.",
  "max-depth": "Flatten the nesting with early returns or extract the inner block into a function.",
  complexity:
    "Split the function: one decision per function, named for what it decides; a lookup " +
    "table or a polymorphic port replaces a long branch chain.",
  "max-lines-per-function": "Extract the steps into small named functions in the same module.",
  "@typescript-eslint/no-explicit-any":
    "Use the official type of the value, a precise union, or unknown narrowed by a Zod schema.",
  "@typescript-eslint/no-non-null-assertion":
    "Narrow the value with a check or a Result union instead of asserting it is present.",
  "@typescript-eslint/no-unused-vars": "Delete the unused binding, import or parameter.",
  "@typescript-eslint/consistent-type-imports": "Import types with `import type`.",
  "aidlc/node-import-protocol": "Import Node built-ins through the node: protocol.",
  "parse-error": "Fix the syntax error so the file parses as TypeScript.",
};

export const fixFor = (request: { readonly category: string; readonly example: string }): string =>
  STANDARD_FIXES[request.category] ??
  (request.example === "" ? `Fix the ${request.category} finding.` : request.example);
