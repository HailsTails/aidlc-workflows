import { expect, test } from "vitest";
import { classAuthoringPlugin } from "./cd14/cd14.eslint-plugin.ts";
import fragment from "./cd14.oxlint.json";

test("the Oxlint fragment loads the CD14 plugin module beside it with the enabled rule", () => {
	expect(new URL(fragment.jsPlugins[0], import.meta.url).href).toBe(
		new URL("./cd14/cd14.eslint-plugin.ts", import.meta.url).href,
	);
	expect(classAuthoringPlugin.meta.name).toBe("rin-discipline");
	expect(classAuthoringPlugin.rules["no-class-authoring"]).toMatchObject({
		meta: { messages: { noClass: expect.stringContaining("CD-14") } },
		create: expect.any(Function),
	});
	expect(fragment.rules).toEqual({ [`${classAuthoringPlugin.meta.name}/no-class-authoring`]: "error" });
});
