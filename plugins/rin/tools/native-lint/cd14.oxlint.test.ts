import { expect, test } from "vitest";
import fragment from "./cd14.oxlint.json";
import { classAuthoringPlugin } from "./cd14/cd14.eslint-plugin.ts";

test("the Oxlint fragment resolves the typed CD14 plugin with the enabled rule", () => {
	const pluginUrl = new URL(fragment.jsPlugins[0], import.meta.url);
	expect(pluginUrl.href).toBe(
		new URL("./cd14/cd14.eslint-plugin.ts", import.meta.url).href,
	);
	expect(classAuthoringPlugin.meta.name).toBe("rin-discipline");
	expect(classAuthoringPlugin.rules["no-class-authoring"]).toMatchObject({
		meta: { messages: { noClass: expect.stringContaining("CD-14") } },
		create: expect.any(Function),
	});
	expect(fragment.rules).toEqual({
		[`${classAuthoringPlugin.meta.name}/no-class-authoring`]: "error",
	});
});
