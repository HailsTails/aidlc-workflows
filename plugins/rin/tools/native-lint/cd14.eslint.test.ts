import { expect, test } from "vitest";
import { cd14EslintEntries } from "./cd14.eslint.ts";
import { classAuthoringPlugin } from "./cd14/cd14.eslint-plugin.ts";

test("the fragment owns only the dedicated CD14 rule", () => {
	expect(cd14EslintEntries).toEqual([
		{
			plugins: { "rin-discipline": classAuthoringPlugin },
			rules: { "rin-discipline/no-class-authoring": "error" },
		},
	]);
	expect(Object.keys(classAuthoringPlugin.rules)).toEqual(["no-class-authoring"]);
});
