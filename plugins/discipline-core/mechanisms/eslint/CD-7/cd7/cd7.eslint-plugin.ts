import type { Rule } from "../../runner/eslint-instance.ts";

type FilenameDisposition = "conventional" | "unconventional";

const NAME_CASE = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))$/u;

const ROUTE_SEGMENT = /^(?:\[{1,2}(?:\.\.\.)?[A-Za-z0-9_-]+\]{1,2}|\([A-Za-z0-9_-]+\))/u;

const LEADING_MARKER = /^[.+$]/u;

const EDGE_UNDERSCORES = /^_+|_+$/gu;

const PATH_SEPARATOR = /[\\/]/u;

const segmentDisposition = (request: { readonly segment: string }): FilenameDisposition =>
  NAME_CASE.test(request.segment) ? "conventional" : "unconventional";

const extensionsDisposition = (request: { readonly extensions: readonly string[] }): FilenameDisposition =>
  request.extensions.every((segment) => segmentDisposition({ segment }) === "conventional")
    ? "conventional"
    : "unconventional";

const routeDisposition = (request: { readonly name: string; readonly route: string }): FilenameDisposition => {
  const rest = request.name.slice(request.route.length);
  if (rest === "") {
    return "conventional";
  }
  return rest.startsWith(".") ? extensionsDisposition({ extensions: rest.slice(1).split(".") }) : "unconventional";
};

const plainDisposition = (request: { readonly name: string }): FilenameDisposition => {
  const [stem = "", ...extensions] = request.name.split(".");
  return segmentDisposition({ segment: stem.replace(EDGE_UNDERSCORES, "") }) === "conventional"
    ? extensionsDisposition({ extensions })
    : "unconventional";
};

const filenameDisposition = (request: { readonly basename: string }): FilenameDisposition => {
  const name = request.basename.replace(LEADING_MARKER, "");
  const route = ROUTE_SEGMENT.exec(name);
  return route === null ? plainDisposition({ name }) : routeDisposition({ name, route: route[0] });
};

const filenameCase: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: { description: "Require kebab-case or PascalCase file names (CD-7)" },
    schema: [],
    messages: {
      filenameCase: "CD-7: name this file in kebab-case or PascalCase.",
    },
  },
  create: (context) => ({
    Program: () => {
      const basename = context.filename.split(PATH_SEPARATOR).at(-1) ?? "";
      if (filenameDisposition({ basename }) === "conventional") {
        return;
      }
      context.report({ loc: { line: 1, column: 0 }, messageId: "filenameCase" });
    },
  }),
};

export default {
  meta: { name: "discipline-cd7", version: "0.0.0-local" },
  rules: { "filename-case": filenameCase },
};
