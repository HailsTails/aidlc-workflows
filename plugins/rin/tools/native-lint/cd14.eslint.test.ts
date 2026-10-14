import { expect, test } from "bun:test";
import { cd14EslintEntries } from "./cd14.eslint.ts";

test("the fragment owns only the dedicated CD14 rule", () => {
	expect(cd14EslintEntries).toMatchObject([
		{
			plugins: { "rin-discipline": { meta: { name: "rin-discipline" } } },
			rules: { "rin-discipline/no-class-authoring": "error" },
		},
	]);
});
