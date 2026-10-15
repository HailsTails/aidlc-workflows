import { expect, test } from "vitest";
import fragment from "../cd14.oxlint.json";

test("the Oxlint fragment loads the shared CD14 rule source", () => {
	expect(fragment).toEqual({
		jsPlugins: ["../../../discipline-core/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts"],
		rules: { "rin-discipline/no-class-authoring": "error" },
	});
});
