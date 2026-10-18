import type { ESLint, Rule } from "eslint";

export type ClassSyntax = {
	readonly filename: string;
	readonly kind: "declaration" | "expression";
	readonly declaration: "ambient" | "runtime";
	readonly container: "ambient" | "runtime";
};
export type ClassDisposition = "allow" | "report";
export type ClassAncestor = {
	readonly type: string;
	readonly declare?: unknown;
	readonly parent?: ClassAncestor | null | undefined;
};
export type ClassAuthoringPlugin = {
	readonly meta: { readonly name: string; readonly version: string };
	readonly rules: Readonly<Record<string, object>>;
};

export const classDisposition = (syntax: ClassSyntax): ClassDisposition => {
	if (syntax.kind === "expression") return "report";
	if (/\.d\.[cm]?ts$/u.test(syntax.filename)) return "allow";
	if (syntax.declaration === "ambient") return "allow";
	if (syntax.container === "ambient") return "allow";
	return "report";
};
const declarationMode = ({
	node,
}: {
	readonly node: object;
}): "ambient" | "runtime" =>
	"declare" in node && node.declare === true ? "ambient" : "runtime";
export const containerMode = ({
	node,
}: {
	readonly node: ClassAncestor | null | undefined;
}): "ambient" | "runtime" => {
	if (node === undefined || node === null) return "runtime";
	if (
		node.type === "TSModuleDeclaration" &&
		declarationMode({ node }) === "ambient"
	)
		return "ambient";
	return containerMode({ node: node.parent });
};
export const noClassAuthoring: Rule.RuleModule = {
	meta: {
		type: "problem",
		docs: { description: "Disallow authored runtime classes (CD-14)" },
		schema: [],
		messages: {
			noClass:
				"CD-14: use functions and closure-backed factories instead of authoring a class.",
		},
	},
	create(context) {
		const reportClass = ({
			node,
			kind,
		}: {
			readonly node: Rule.Node;
			readonly kind: "declaration" | "expression";
		}): void => {
			const disposition = classDisposition({
				filename: context.filename,
				kind,
				declaration: declarationMode({ node }),
				container: containerMode({ node: node.parent }),
			});
			if (disposition === "allow") return;
			context.report({ node, messageId: "noClass" });
		};
		return {
			ClassDeclaration: (node) => reportClass({ node, kind: "declaration" }),
			ClassExpression: (node) => reportClass({ node, kind: "expression" }),
		};
	},
};
const checkedPlugin = {
	meta: { name: "rin-discipline", version: "0.0.0-local" },
	rules: { "no-class-authoring": noClassAuthoring },
} satisfies ESLint.Plugin;
export const classAuthoringPlugin: ClassAuthoringPlugin = checkedPlugin;
export default classAuthoringPlugin;
