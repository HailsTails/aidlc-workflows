import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import { describe, expect, vi, test } from "vitest";
import {
	classDisposition,
	createClassReporter,
	type ClassAncestor,
	type ClassDiagnosticPort,
	noClassAuthoring,
} from "./cd14.eslint-plugin.ts";

RuleTester.describe = describe;
RuleTester.it = test;

test("runtime class declarations are reported", () => {
	expect(
		classDisposition({
			filename: "src/runtime.ts",
			kind: "declaration",
			declaration: "runtime",
			container: "runtime",
		}),
	).toBe("report");
});
test("class expressions stay runtime syntax", () => {
	expect(
		classDisposition({
			filename: "src/runtime.ts",
			kind: "expression",
			declaration: "runtime",
			container: "runtime",
		}),
	).toBe("report");
});
test("ambient class declarations are type-only", () => {
	expect(
		classDisposition({
			filename: "src/ambient.ts",
			kind: "declaration",
			declaration: "ambient",
			container: "runtime",
		}),
	).toBe("allow");
});
test("declaration files are type-only", () => {
	expect(
		classDisposition({
			filename: "src/external.d.ts",
			kind: "declaration",
			declaration: "runtime",
			container: "runtime",
		}),
	).toBe("allow");
});
test("classes enclosed by ambient modules are type-only", () => {
	expect(
		classDisposition({
			filename: "src/ambient.ts",
			kind: "declaration",
			declaration: "runtime",
			container: "ambient",
		}),
	).toBe("allow");
});
test("the rule publishes the original runtime class through its injected diagnostic port", () => {
	const publish = vi.fn<ClassDiagnosticPort<ClassAncestor>["publish"]>();
	const reporter = createClassReporter({
		port: { filename: "src/runtime.ts", publish },
	});
	reporter.reportClass({
		node: { type: "ClassDeclaration", parent: null },
		kind: "declaration",
	});
	expect(publish).toHaveBeenCalledWith({
		node: { type: "ClassDeclaration", parent: null },
		messageId: "noClass",
	});
});
test("the rule does not publish an ambient class", () => {
	const publish = vi.fn<ClassDiagnosticPort<ClassAncestor>["publish"]>();
	const reporter = createClassReporter({
		port: { filename: "src/ambient.ts", publish },
	});
	reporter.reportClass({
		node: { type: "ClassDeclaration", declare: true, parent: null },
		kind: "declaration",
	});
	expect(publish).not.toHaveBeenCalled();
});
test("the rule publishes runtime class expressions", () => {
	const publish = vi.fn<ClassDiagnosticPort<ClassAncestor>["publish"]>();
	const reporter = createClassReporter({
		port: { filename: "src/runtime.ts", publish },
	});
	reporter.reportClass({
		node: { type: "ClassExpression", parent: null },
		kind: "expression",
	});
	expect(publish).toHaveBeenCalledWith({
		node: { type: "ClassExpression", parent: null },
		messageId: "noClass",
	});
});

const tester = new RuleTester({
	languageOptions: { ecmaVersion: "latest", sourceType: "module" },
});
tester.run("rin-discipline/no-class-authoring", noClassAuthoring, {
	valid: [
		"const client = new LibraryClient();",
		"export const factory = () => ({ value: 1 });",
	],
	invalid: [
		{
			code: "class Internal {}",
			errors: [{ messageId: "noClass" }],
		},
		{
			code: "const Internal = class {};",
			errors: [{ messageId: "noClass" }],
		},
		{
			code: "export default class {}",
			errors: [{ messageId: "noClass" }],
		},
		{
			code: "function factory() { class Nested {} return Nested; }",
			errors: [{ messageId: "noClass" }],
		},
	],
});

const typescriptTester = new RuleTester({
	languageOptions: {
		parser: tsParser,
		ecmaVersion: "latest",
		sourceType: "module",
	},
});
typescriptTester.run(
	"rin-discipline/no-class-authoring TypeScript",
	noClassAuthoring,
	{
		valid: [
			{ code: "declare class Ambient {}", filename: "ambient.ts" },
			{
				code: "declare namespace Ambient { class Internal {} }",
				filename: "ambient.ts",
			},
			{
				code: 'declare module "external" { class Internal {} }',
				filename: "ambient.ts",
			},
			{
				code: "export {}; declare global { class Internal {} }",
				filename: "ambient.ts",
			},
			{ code: "class Declaration {}", filename: "external.d.ts" },
		],
		invalid: [
			{
				code: "namespace Runtime { export class Internal {} }",
				filename: "runtime.ts",
				errors: [{ messageId: "noClass" }],
			},
		],
	},
);
