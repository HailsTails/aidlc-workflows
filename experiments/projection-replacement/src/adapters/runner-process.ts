import type { HarnessBinding } from "../domain/harness-binding.ts";
import type { RunnerRequest } from "../domain/generated-runner.ts";
import { finding, type Outcome } from "../domain/model.ts";
import { createNativeCompilerProcessOperations, compilerSystemEnvironment, type NativeCompilerProcessOperations, type NativeCompilerSpawnInput, type NativeCompilerSpawnReply } from "./native-compiler-process.ts";

export type RunnerRuntime = { readonly root: string; readonly binding: HarnessBinding };
export type KeyedRunnerRequest = { readonly key: string; readonly request: RunnerRequest };
export type RunnerSpawnInput = NativeCompilerSpawnInput;
export type RunnerSpawnReply = NativeCompilerSpawnReply;
export type RunnerProcessOperations = NativeCompilerProcessOperations & {
  readonly paths: (input: { readonly runtime: RunnerRuntime }) => { readonly root: string; readonly moduleUrl: string; readonly pathsUrl: string; readonly home: string; readonly graph: string };
};
export const createRunnerProcessOperations = (): RunnerProcessOperations => ({
  ...createNativeCompilerProcessOperations(),
  paths: ({ runtime }) => {
    const root = Bun.fileURLToPath(Bun.pathToFileURL(runtime.root));
    const tools = `${root}/${runtime.binding.directory}/tools`;
    return { root, moduleUrl: Bun.pathToFileURL(`${tools}/aidlc-runner-gen.ts`).href, pathsUrl: Bun.pathToFileURL(`${tools}/aidlc-runtime-paths.ts`).href, home: `${root}/../.runner-home/${runtime.binding.harness}`, graph: `${tools}/data/stage-graph.json` };
  },
});
const compilerProgram = `
const input = await Bun.stdin.json();
const paths = await import(input.pathsUrl);
const matches = paths.discoverProjectHarnesses(input.root).some(entry => entry.distribution === input.binding.harness && entry.harnessDir === input.binding.directory);
const unavailable = ({ detail }) => input.requests.map(entry => ({ key: entry.key, status: "unavailable", detail }));
const nativeOwner = ({ plugin }) => plugin === undefined ? { kind: "core", id: "framework" } : { kind: "plugin", id: plugin };
const compile = async () => {
  if (input.intent === "discover") {
    if (!matches) return { status: "unavailable", detail: "prepared runtime does not declare the requested harness binding" };
    const graph = process.env.AIDLC_STAGE_GRAPH;
    if (!graph || !await Bun.file(graph).exists()) return { status: "unavailable", detail: "compiled stage graph is unavailable" };
    const scopeRoot = paths.resolveHarnessPath(["scopes"]);
    const observeDirectory = async ({ relative }) => {
      try {
        const stat = await Bun.file(input.root + "/" + relative).stat();
        return stat.isDirectory()
          ? { status: "ok", directory: { path: relative, status: "present" } }
          : { status: "unavailable", detail: "native runner input is not a directory: " + relative };
      } catch (error) {
        return error?.code === "ENOENT"
          ? { status: "ok", directory: { path: relative, status: "absent" } }
          : { status: "unavailable", detail: "native runner input directory observation unavailable: " + relative };
      }
    };
    const directoryFingerprint = async () => {
      const observed = await Promise.all([input.binding.directory + "/skills", input.binding.directory + "/scopes"].map(relative => observeDirectory({ relative })));
      return observed.find(entry => entry.status !== "ok") ?? { status: "ok", directories: observed.map(entry => entry.directory) };
    };
    const beforeDirectories = await directoryFingerprint();
    if (beforeDirectories.status !== "ok") return beforeDirectories;
    const artifact = await import(Bun.pathToFileURL(input.root + "/" + input.binding.directory + "/tools/aidlc-distribution.ts").href);
    const scopeNames = () => artifact.walkFiles(scopeRoot).map(name => name.replaceAll("\\\\", "/")).filter(name => !name.includes("/") && name.endsWith(".md")).sort().map(name => "scopes/" + name);
    const inputPaths = ["tools/data/harness.json", "tools/data/stage-graph.json", "tools/data/scope-grid.json", ...scopeNames()];
    const fingerprint = async () => Promise.all(inputPaths.map(async relative => ({ path: input.binding.directory + "/" + relative, sha256: new Bun.CryptoHasher("sha256").update(await Bun.file(input.root + "/" + input.binding.directory + "/" + relative).bytes()).digest("hex") })));
    const before = await fingerprint();
    const generator = await import(input.moduleUrl);
    const nativeRoot = paths.resolveSkillsPath().replaceAll("\\\\", "/");
    const prefix = input.root.replaceAll("\\\\", "/") + "/";
    if (!nativeRoot.startsWith(prefix)) return { status: "unavailable", detail: "native runner discovery resolved a skill root outside the prepared runtime" };
    const skillRoot = nativeRoot.slice(prefix.length);
    const stages = generator.runnableStages();
    const scopes = generator.discoverScopes();
    const entries = [...stages.map(stage => ({ request: { kind: "stage", slug: stage.slug }, owner: nativeOwner({ plugin: stage.plugin }), markdown: generator.renderStageRunner(stage) })), ...generator.defaultScopeBatch(scopes).map(scope => ({ request: { kind: "scope", scope }, owner: nativeOwner({ plugin: scopes[scope].plugin }), markdown: generator.renderRunner(scope, scopes[scope].description) })), { request: { kind: "init" }, owner: nativeOwner({}), markdown: generator.renderInitRunner() }, { request: { kind: "compose" }, owner: nativeOwner({}), markdown: generator.renderComposeRunner() }];
    const after = await fingerprint();
    const afterNames = scopeNames();
    const afterDirectories = await directoryFingerprint();
    if (afterDirectories.status !== "ok") return afterDirectories;
    if (JSON.stringify(before) !== JSON.stringify(after) || JSON.stringify(inputPaths.slice(3)) !== JSON.stringify(afterNames) || JSON.stringify(beforeDirectories.directories) !== JSON.stringify(afterDirectories.directories)) return { status: "unavailable", detail: "native runner inputs changed during discovery; retry from a stable prepared runtime" };
    return { status: "ok", scope: "native-generated-runners", skillRoot, entries, inputs: after, directoryInputs: afterDirectories.directories };
  }
  if (!matches) return unavailable({ detail: "prepared runtime does not declare the requested harness binding" });
  const generator = await import(input.moduleUrl);
  const stages = input.requests.some(entry => entry.request.kind === "stage") ? generator.runnableStages() : [];
  const scopes = input.requests.some(entry => entry.request.kind === "scope") ? generator.discoverScopes() : {};
  const shippedScopes = generator.defaultScopeBatch(scopes);
  return input.requests.map(entry => {
    const request = entry.request;
    if (request.kind === "stage") {
      const stage = stages.find(stage => stage.slug === request.slug);
      return stage ? { key: entry.key, status: "ok", owner: nativeOwner({ plugin: stage.plugin }), markdown: generator.renderStageRunner(stage) } : { key: entry.key, status: "unavailable", detail: "stage is absent from the runnable compiled graph: " + request.slug };
    }
    if (request.kind === "scope") {
      return shippedScopes.includes(request.scope) && scopes[request.scope] ? { key: entry.key, status: "ok", owner: nativeOwner({ plugin: scopes[request.scope].plugin }), markdown: generator.renderRunner(request.scope, scopes[request.scope].description) } : { key: entry.key, status: "unavailable", detail: "scope is not marked for a shipped runner: " + request.scope };
    }
    if (request.kind === "init") return { key: entry.key, status: "ok", owner: nativeOwner({}), markdown: generator.renderInitRunner() };
    return { key: entry.key, status: "ok", owner: nativeOwner({}), markdown: generator.renderComposeRunner() };
  });
};
process.stdout.write(JSON.stringify(await compile()));
`;
export type RunnerProcess = { readonly execute: (input: { readonly runtime: RunnerRuntime; readonly requests: readonly KeyedRunnerRequest[]; readonly intent?: "discover" }) => Outcome<unknown> };
export const createRunnerProcess = ({ binary = "bun", operations = createRunnerProcessOperations() }: { readonly binary?: string; readonly operations?: RunnerProcessOperations } = {}): RunnerProcess => ({
  execute: ({ runtime, requests, intent }) => {
    const paths = operations.paths({ runtime });
    const inherited = compilerSystemEnvironment({ inherited: operations.environment() });
    const env = { ...inherited, ...Object.fromEntries([["HOME", paths.home], ["USERPROFILE", paths.home], ["APPDATA", paths.home], ["LOCALAPPDATA", paths.home], ["XDG_CONFIG_HOME", paths.home], ["AIDLC_RUNTIME_PROJECT_DIR", paths.root], ["AIDLC_PROJECT_DIR", paths.root], ["AIDLC_HARNESS_DIR", runtime.binding.directory], ["AIDLC_HARNESS_NAME", runtime.binding.harness], ["AIDLC_STAGE_GRAPH", paths.graph]]) };
    const input = JSON.stringify({ root: paths.root, binding: runtime.binding, moduleUrl: paths.moduleUrl, pathsUrl: paths.pathsUrl, requests, ...(intent === undefined ? {} : { intent }) });
    const reply = operations.spawn({ binary, args: ["--no-install", "--eval", compilerProgram], cwd: paths.root, input, env });
    if (reply.error !== null || reply.exitCode !== 0)
      return { status: "invalid", findings: [finding({ code: "capability-gap", subject: runtime.binding.harness, detail: `runner compiler process unavailable: ${reply.error ?? (reply.stderr.trim() || `exit ${reply.exitCode}`)}` })] };
    if (intent === "discover" && reply.stderr.trim().length > 0)
      return { status: "invalid", findings: [finding({ code: "capability-gap", subject: runtime.binding.harness, detail: `native runner discovery reported diagnostics; no complete requirement set was accepted: ${reply.stderr.trim()}` })] };
    try {
      const decoded: unknown = JSON.parse(reply.stdout);
      return { status: "ok", value: decoded };
    } catch {
      return { status: "invalid", findings: [finding({ code: "invalid-json", subject: runtime.binding.harness, detail: "runner compiler must return one JSON response without surrounding output" })] };
    }
  },
});
