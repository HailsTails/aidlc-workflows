import { expect, test } from "vitest";
import fragment from "./cd14.oxlint.json";

test("the Oxlint fragment resolves a CD14 plugin with the enabled rule", async () => {
	const pluginUrl = new URL(fragment.jsPlugins[0], import.meta.url);
	const { default: plugin } = await import(pluginUrl.href);
	expect(plugin.meta.name).toBe("rin-discipline");
	expect(plugin.rules["no-class-authoring"]).toMatchObject({
		meta: { messages: { noClass: expect.stringContaining("CD-14") } },
		create: expect.any(Function),
	});
	expect(fragment.rules).toEqual({ [`${plugin.meta.name}/no-class-authoring`]: "error" });
});
