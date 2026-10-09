import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { createPluginRuntimePort } from "./plugin-runtime.ts";

function runtimeFixture(input: { readonly root: string }): string {
  const pluginRoot = join(input.root, "plugins", "fixture");
  mkdirSync(join(pluginRoot, "tools"), { recursive: true });
  mkdirSync(join(input.root, "node_modules", "location-fixture"), { recursive: true });
  cpSync(dirname(require.resolve("typescript/package.json")), join(input.root, "node_modules", "typescript"), { recursive: true });
  mkdirSync(join(input.root, "node_modules", "conditional-fixture"), { recursive: true });
  writeFileSync(join(input.root, "node_modules", "conditional-fixture", "package.json"),
    '{"name":"conditional-fixture","exports":{"bun":"./bun.js","node":"./node.js","default":"./default.js"}}');
  writeFileSync(join(input.root, "node_modules", "conditional-fixture", "bun.js"), 'export default "bun-selected";');
  writeFileSync(join(input.root, "node_modules", "conditional-fixture", "node.js"), 'export default "node-selected";');
  writeFileSync(join(input.root, "node_modules", "conditional-fixture", "default.js"), 'export default "default-selected";');
  mkdirSync(join(input.root, "node_modules", "legacy-fixture"), { recursive: true });
  writeFileSync(join(input.root, "node_modules", "legacy-fixture", "package.json"),
    '{"name":"legacy-fixture","module":"./module.js","main":"./main.cjs"}');
  writeFileSync(join(input.root, "node_modules", "legacy-fixture", "module.js"), 'export default "module-selected";');
  writeFileSync(join(input.root, "node_modules", "legacy-fixture", "main.cjs"), 'module.exports = "main-selected";');
  writeFileSync(join(input.root, "tsconfig.json"), '{"compilerOptions":{"strict":true}}');
  writeFileSync(join(input.root, "node_modules", "location-fixture", "package.json"), '{"name":"location-fixture","main":"index.cjs"}');
  writeFileSync(join(input.root, "node_modules", "location-fixture", "index.cjs"),
    'module.exports = { filename: __filename, dirname: __dirname };');
  writeFileSync(join(pluginRoot, "tools", "entry.ts"), `
import ts from "typescript";
import location from "location-fixture";
import conditional from "conditional-fixture";
import legacy from "legacy-fixture";
export const __dirname = "authored-directory";
export const __filename = "authored-filename";
import { sibling } from "./sibling.ts";
export { location, sibling, conditional, legacy };
export const authoredUrl = import.meta.url;
export const authoredMain = import.meta.main;
export const parsed = ts.createSourceFile("example.ts", "const answer = 42", ts.ScriptTarget.Latest).statements.length;
if (import.meta.main) console.log(JSON.stringify({ main: import.meta.main, url: import.meta.url }));
`);
  return pluginRoot;
}

describe("runtime companion bundler integration", () => {
  test("emits identical compiler bundles from distinct dependency roots and retains relocated runtime semantics", async () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "aidlc-runtime-roots-"));
    try {
      const firstRoot = join(fixtureRoot, "first-checkout");
      const secondRoot = join(fixtureRoot, "different", "second-checkout");
      const firstPlugin = runtimeFixture({ root: firstRoot });
      const secondPlugin = runtimeFixture({ root: secondRoot });
      const first = await createPluginRuntimePort({ projectRoot: firstRoot }).bundle({
        pluginRoot: firstPlugin, file: "tools/entry.ts", relativeImports: ["./sibling.ts"],
      });
      const second = await createPluginRuntimePort({ projectRoot: secondRoot }).bundle({
        pluginRoot: secondPlugin, file: "tools/entry.ts", relativeImports: ["./sibling.ts"],
      });
      expect(first).toBe(second);
      expect(first).not.toContain(firstRoot);
      expect(first).not.toContain(secondRoot);
      expect(first).toContain('"./sibling.ts"');
      const relocated = join(fixtureRoot, "installed", "tools");
      mkdirSync(relocated, { recursive: true });
      writeFileSync(join(relocated, "entry.runtime.js"), first);
      writeFileSync(join(relocated, "entry.ts"), 'export * from "./entry.runtime.js";');
      writeFileSync(join(relocated, "sibling.ts"), 'export const sibling = "preserved";');
      rmSync(firstRoot, { recursive: true });
      rmSync(secondRoot, { recursive: true });
      const loaded = z.object({
        location: z.object({ filename: z.string(), dirname: z.string() }),
        authoredUrl: z.string(), authoredMain: z.boolean(), parsed: z.number(),
        sibling: z.string(), conditional: z.string(), legacy: z.string(),
        __dirname: z.string(), __filename: z.string(),
      }).parse(await import(pathToFileURL(join(relocated, "entry.runtime.js")).href));
      expect(loaded.location).toEqual({ filename: join(relocated, "entry.runtime.js"), dirname: relocated });
      expect(loaded.authoredUrl).toBe(pathToFileURL(join(relocated, "entry.ts")).href);
      expect(loaded.authoredMain).toBe(false);
      expect(loaded.parsed).toBe(1);
      expect(loaded.sibling).toBe("preserved");
      expect(loaded.conditional).toBe("bun-selected");
      expect(loaded.legacy).toBe("module-selected");
      expect(loaded.__dirname).toBe("authored-directory");
      expect(loaded.__filename).toBe("authored-filename");
      const direct = spawnSync(process.execPath, [join(relocated, "entry.ts")], {
        cwd: relocated, encoding: "utf-8", timeout: 30000,
        env: { PATH: "", HOME: fixtureRoot },
      });
      expect(direct.status).toBe(0);
      expect(z.object({ main: z.boolean(), url: z.string() }).parse(JSON.parse(direct.stdout)))
        .toEqual({ main: true, url: pathToFileURL(join(relocated, "entry.ts")).href });
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
