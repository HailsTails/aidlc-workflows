// Local ESLint plugin; Oxlint's jsPlugins API loads this same module.
const noClassAuthoring = {
  meta: {
    type: "problem",
    docs: { description: "Disallow authored runtime classes (CD-14)" },
    schema: [],
    messages: {
      noClass: "CD-14: use functions and closure-backed factories instead of authoring a class.",
    },
  },
  create(context) {
    const declarationFile = /\.d\.[cm]?ts$/u.test(context.filename);
    const withinAmbientNamespace = (node) => {
      for (let parent = node.parent; parent; parent = parent.parent) {
        if (parent.type === "TSModuleDeclaration" && parent.declare === true) return true;
      }
      return false;
    };
    return {
      ClassDeclaration(node) {
        if (!declarationFile && node.declare !== true && !withinAmbientNamespace(node)) {
          context.report({ node, messageId: "noClass" });
        }
      },
      ClassExpression(node) {
        context.report({ node, messageId: "noClass" });
      },
    };
  },
};

export default {
  meta: { name: "rin-discipline", version: "0.0.0-local" },
  rules: { "no-class-authoring": noClassAuthoring },
};
