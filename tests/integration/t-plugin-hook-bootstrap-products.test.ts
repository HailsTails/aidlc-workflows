import { afterAll, expect, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildPluginProjection, readPluginTargets } from "../../dist/claude/.claude/tools/aidlc-plugin-emit.ts";
import type { BuildPluginProjectionOptions } from "../../dist/claude/.claude/tools/aidlc-plugin-emit.ts";
import { createTestProject, cleanupTestProject, REPO_ROOT } from "../harness/fixtures.ts";

const scratch = createTestProject();
const templates = join(REPO_ROOT, "dist", "claude", ".claude", "tools", "data", "plugin-hooks-template");
const target = readPluginTargets(join(REPO_ROOT, "dist", "claude", ".claude", "tools", "data", "plugin-targets.json")).claude;

export type HookProductFixture = {
  readonly options: BuildPluginProjectionOptions;
  readonly authoredOutputPath: string;
  readonly bootstrapOutputPath: string;
};
export type AliasHookProductFixture = HookProductFixture & { readonly caseAliasExists: boolean };

afterAll(() => cleanupTestProject(scratch));

const pluginFixture = ({ name, hookFile, hookText }: { readonly name: string; readonly hookFile: string; readonly hookText: string }): HookProductFixture => {
  const pluginRoot = join(scratch, name);
  const templateHooksDir = join(scratch, `${name}-templates`);
  const outDir = join(scratch, `${name}-output`);
  cpSync(join(REPO_ROOT, "plugins", "test-pro"), pluginRoot, { recursive: true });
  cpSync(templates, templateHooksDir, { recursive: true });
  writeFileSync(join(templateHooksDir, "compose.ts"), 'export const composeBootstrap = "owned";\n');
  const authoredPath = join(pluginRoot, "hooks", hookFile);
  mkdirSync(dirname(authoredPath), { recursive: true });
  writeFileSync(authoredPath, hookText);
  return {
    options: { pluginRoot, target, templateHooksDir, outDir },
    authoredOutputPath: join(outDir, "hooks", hookFile),
    bootstrapOutputPath: join(outDir, "hooks", "compose.ts"),
  };
};

const helperFixture = ({ name, authoredName }: { readonly name: string; readonly authoredName: string }): HookProductFixture => {
  const fixture = pluginFixture({ name, hookFile: authoredName, hookText: 'export const bootstrapHelper = "owned";\n' });
  writeFileSync(join(fixture.options.templateHooksDir, "bootstrap-helper.ts"), 'export const bootstrapHelper = "owned";\n');
  return fixture;
};

const aliasFixture = (): AliasHookProductFixture => {
  const fixture = helperFixture({ name: "aliased-bootstrap-helper", authoredName: "BOOTSTRAP-HELPER.ts" });
  writeFileSync(join(scratch, "bootstrap-case-alias-probe"), "owned test file\n");
  return { ...fixture, caseAliasExists: existsSync(join(scratch, "BOOTSTRAP-CASE-ALIAS-PROBE")) };
};

test("a mismatched vendored compose hook still refuses the build", () => {
  const fixture = pluginFixture({ name: "mismatched-vendored-hook", hookFile: "compose.ts", hookText: 'console.log("not the bootstrap");\n' });
  expect(() => buildPluginProjection(fixture.options)).toThrow("differs from bundled compose template");
});

test("a nested compose basename does not claim the bootstrap destination", () => {
  const fixture = pluginFixture({ name: "nested-compose-hook", hookFile: "sub/compose.ts", hookText: 'export const nestedHook = "authored";\n' });
  buildPluginProjection(fixture.options);
  expect(readFileSync(fixture.authoredOutputPath, "utf-8")).toBe('export const nestedHook = "authored";\n');
  expect(readFileSync(fixture.bootstrapOutputPath, "utf-8")).toBe('export const composeBootstrap = "owned";\n');
});

test("a host-unemitted bootstrap helper name remains an authored hook", () => {
  const fixture = pluginFixture({ name: "unemitted-helper-hook", hookFile: "aidlc-plugin-compose.ts", hookText: 'export const authoredHelper = "claude";\n' });
  buildPluginProjection(fixture.options);
  expect(readFileSync(fixture.authoredOutputPath, "utf-8")).toBe('export const authoredHelper = "claude";\n');
});

test("an authored hook cannot claim another emitted bootstrap helper", () => {
  const fixture = helperFixture({ name: "claimed-bootstrap-helper", authoredName: "bootstrap-helper.ts" });
  expect(() => buildPluginProjection(fixture.options)).toThrow("authored hook collides with compose bootstrap");
});

test("a filesystem case alias cannot replace an emitted bootstrap helper", () => {
  const fixture = aliasFixture();
  expect(fixture.caseAliasExists, "Fixture requires case-insensitive scratch storage").toBe(true);
  expect(() => buildPluginProjection(fixture.options)).toThrow("authored hook collides with compose bootstrap");
});
