import { afterAll, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const scratch = mkdtempSync(join(tmpdir(), "rin-preview-runtime-"));
const childEnvironment = Object.fromEntries([
  ["PATH", process.env["PATH"]],
  ["SystemRoot", process.env["SystemRoot"]],
  ["ComSpec", process.env["ComSpec"]],
  ["HOME", scratch],
  ["USERPROFILE", scratch],
  ["APPDATA", scratch],
  ["LOCALAPPDATA", scratch],
  ["TEMP", scratch],
  ["TMP", scratch],
  ["TMPDIR", scratch],
]);
const hookSource = join(import.meta.dir, "../../plugins/rin/hooks");
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const registrySource = `export const mainRootFrom = ({ anyRepoDirectory }) => { console.log("root"); return anyRepoDirectory; };
export const readRegistry = () => { console.log("read"); return { worktrees: {} }; };
export const prunedWorktrees = ({ worktrees }) => { console.log("prune"); return worktrees; };
export const writeRegistry = () => { console.log("write"); };
`;
const generatorSource = 'export const generatePreviewLaunch = () => { console.log("generate"); };\n';
const incompatibleRegistrySource = `export const mainRootFrom = () => { console.log("must not run"); };
export const readRegistry = () => ({ worktrees: {} });
export const prunedWorktrees = ({ worktrees }) => worktrees;
`;

export type PreviewHookObservation = { readonly exitCode: number | null; readonly stdout: string; readonly stderr: string };
export type PreviewHookFixture = { readonly directory: string; readonly hook: string };
export type PreviewModuleInput = { readonly fixture: PreviewHookFixture; readonly generator: string; readonly registry: string };

const projectFixture = ({ name }: { readonly name: string }): PreviewHookFixture => {
  const directory = join(scratch, `${name} # fixture`);
  const hooks = join(directory, ".claude", "hooks");
  mkdirSync(hooks, { recursive: true });
  cpSync(join(hookSource, "stamp-preview-target.mjs"), join(hooks, "stamp-preview-target.mjs"));
  cpSync(join(hookSource, "preview-runtime-contract.mjs"), join(hooks, "preview-runtime-contract.mjs"));
  return { directory, hook: join(hooks, "stamp-preview-target.mjs") };
};

const fileMarkerFixture = ({ name }: { readonly name: string }): PreviewHookFixture => {
  const fixture = projectFixture({ name });
  writeFileSync(join(fixture.directory, ".git"), "owned hook marker fixture\n");
  return fixture;
};

const directoryMarkerFixture = ({ name }: { readonly name: string }): PreviewHookFixture => {
  const fixture = projectFixture({ name });
  mkdirSync(join(fixture.directory, ".git"));
  return fixture;
};

const suppliedModules = ({ fixture, generator, registry }: PreviewModuleInput): void => {
  const scripts = join(fixture.directory, "scripts");
  mkdirSync(scripts);
  writeFileSync(join(scripts, "generate-preview-launch.mjs"), generator);
  writeFileSync(join(scripts, "preview-worktree-registry.mjs"), registry);
};

const absentModules = (): void => undefined;

const runFixture = ({ fixture }: { readonly fixture: PreviewHookFixture }): PreviewHookObservation => {
  const child = spawnSync("node", [fixture.hook], { cwd: fixture.directory, env: childEnvironment, input: '{"hook_event_name":"SessionStart"}', encoding: "utf8", timeout: 30000 });
  return { exitCode: child.status, stdout: child.stdout, stderr: child.stderr };
};

test.each([
  { name: "a directory marker makes registration not applicable", arrange: directoryMarkerFixture, supply: absentModules, generator: "", registry: "", expected: { exitCode: 0, stdout: "", stderr: "" } },
  { name: "a non-worktree session does not evaluate supplied helpers", arrange: directoryMarkerFixture, supply: suppliedModules, generator: 'console.log("module-loaded"); export const generatePreviewLaunch = () => undefined;\n', registry: registrySource, expected: { exitCode: 0, stdout: "", stderr: "" } },
  { name: "a file marker requests registration and exposes unavailable helpers", arrange: fileMarkerFixture, supply: absentModules, generator: "", registry: "", expected: { exitCode: 1, stdout: "", stderr: "Rin preview registration unavailable: project scripts must provide generate-preview-launch.mjs and preview-worktree-registry.mjs.\n" } },
  { name: "project fixture helpers load from a space and hash path", arrange: fileMarkerFixture, supply: suppliedModules, generator: generatorSource, registry: registrySource, expected: { exitCode: 0, stdout: "root\nread\nprune\nwrite\ngenerate\n", stderr: "" } },
  { name: "all exports are admitted before any helper function runs", arrange: fileMarkerFixture, supply: suppliedModules, generator: generatorSource, registry: incompatibleRegistrySource, expected: { exitCode: 1, stdout: "", stderr: "Rin preview registration unavailable: project preview helpers do not provide the required registration exports.\n" } },
  { name: "an execution exception is visible without its private message", arrange: fileMarkerFixture, supply: suppliedModules, generator: 'export const generatePreviewLaunch = () => { throw new Error("FIXTURE_PRIVATE_TOKEN_DO_NOT_LOG"); };\n', registry: registrySource, expected: { exitCode: 1, stdout: "root\nread\nprune\nwrite\n", stderr: "Rin preview registration failed: project preview helpers could not complete registration.\n" } },
  { name: "invalid syntax in an existing helper is a load failure", arrange: fileMarkerFixture, supply: suppliedModules, generator: "export const generatePreviewLaunch = ;\n", registry: registrySource, expected: { exitCode: 1, stdout: "", stderr: "Rin preview registration failed: project preview helpers could not be loaded.\n" } },
  { name: "a missing transitive dependency is not an absent top-level helper", arrange: fileMarkerFixture, supply: suppliedModules, generator: 'import "./unavailable-project-dependency.mjs"; export const generatePreviewLaunch = () => undefined;\n', registry: registrySource, expected: { exitCode: 1, stdout: "", stderr: "Rin preview registration failed: project preview helpers could not be loaded.\n" } },
])("$name", ({ name, arrange, supply, generator, registry, expected }) => {
  const fixture = arrange({ name });
  supply({ fixture, generator, registry });
  expect(runFixture({ fixture })).toEqual(expected);
});
