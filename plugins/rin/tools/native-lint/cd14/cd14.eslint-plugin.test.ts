import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import { describe, expect, test } from "vitest";
import { classDisposition, noClassAuthoring } from "./cd14.eslint-plugin.ts";

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
				code: "class Internal {}",
				filename: "runtime.ts",
				errors: [{ messageId: "noClass" }],
			},
			{
				code: "const Internal = class {};",
				filename: "runtime.ts",
				errors: [{ messageId: "noClass" }],
			},
			{
				code: "namespace Runtime { export class Internal {} }",
				filename: "runtime.ts",
				errors: [{ messageId: "noClass" }],
			},
		],
	},
);
