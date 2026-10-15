import { expect, test } from "vitest";
import fragment from "./cd14.oxlint.json";
import loadedPlugin, { classAuthoringPlugin } from "./cd14/cd14.eslint-plugin.ts";

test("the Oxlint fragment resolves the typed CD14 plugin with the enabled rule", () => {
	expect(loadedPlugin).toBe(classAuthoringPlugin);
	expect(fragment.jsPlugins).toEqual(["./cd14/cd14.eslint-plugin.ts"]);
	expect(classAuthoringPlugin.meta.name).toBe("rin-discipline");
	expect(classAuthoringPlugin.rules["no-class-authoring"]).toMatchObject({
		meta: { messages: { noClass: expect.stringContaining("CD-14") } },
		create: expect.any(Function),
	});
	expect(fragment.rules).toEqual({
		"rin-discipline/no-class-authoring": "error",
	});
});
