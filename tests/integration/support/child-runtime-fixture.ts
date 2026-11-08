import { spawnSync } from "node:child_process";
import { z } from "zod";
import { createRuntimeFixtureFilesystem } from "../../harness/runtime-fixture-filesystem.ts";
import { NATIVE_MULTI_WORKTREE_CASE_TIMEOUT_MS } from "../../harness/test-budget.ts";
import { packageInputsFingerprint } from "../../../scripts/package-sources.ts";
import { observeProductionInputs, verifyProductionInputs } from "../../../scripts/projection/src/adapters/source-input-contract.ts";

import type { SourceContentDigest } from "../../../scripts/projection/src/domain/source-origin.ts";

export type RuntimeInputWitness = { readonly fingerprint: string; readonly inputs: readonly SourceContentDigest[] };

const filesystem = createRuntimeFixtureFilesystem();
const runtimeModule = "scripts/projection/src/adapters/child-runtime-directory.ts";
const readLines = (location: { readonly root: string; readonly relative: string }) => filesystem.read(location).trim().split("\n").map(line => JSON.parse(line));
export const sessionScratchRoots = () => [...filesystem.temporaryEntries("aidlc-runtime-"), ...filesystem.temporaryEntries("aidlc-distribution-")].sort();
export const createRuntimeSourceFixture = () => filesystem.create({ prefix: "runtime-fixture-", sources: ["core", "scripts", "package.json", "bun.lock", "harness/claude"], dependencies: "repository-link" });
export const removeRuntimeSourceFixture = (root: string) => filesystem.remove({ root });
export const appendRuntimeSource = ({ root, relative, text }: { readonly root: string; readonly relative: string; readonly text: string }) => {
  filesystem.write({ root, relative, text: `${filesystem.read({ root, relative })}\n${text}\n` });
};
export const setRuntimeCallback = ({ root, text }: { readonly root: string; readonly text: string }) => {
  const location = { root, relative: "harness/claude/manifest.ts" };
  const source = filesystem.read(location);
  filesystem.write({ ...location, text: source.replace("export default manifest;", `let count = 0; const prior = manifest.emit; manifest.emit = ctx => { prior?.(ctx); count++; ${text} }; export default manifest;`) });
};
export const executeRuntimeFixture = (root: string) => spawnSync(process.execPath, ["--no-env-file", "--no-install", "scripts/package.ts", "claude"], { cwd: root, encoding: "utf8", timeout: NATIVE_MULTI_WORKTREE_CASE_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 });
export const runtimeOutputPresence = (root: string) => ["dist/claude/.claude/settings.json", "dist-release/claude/.claude/settings.json"].map(file => filesystem.observe(filesystem.path({ root, relative: file })).presence === "present");
export const instrumentRuntimeFixture = (root: string) => {
  instrumentCompilerProcesses(root);
  appendRuntimeSource({ root, relative: "core/tools/aidlc-utility.ts", text: `require("node:fs").appendFileSync(${JSON.stringify(filesystem.path({ root, relative: "runtime-trace.jsonl" }))}, JSON.stringify({ home: process.env.HOME, temp: process.env.TEMP, bun: process.env.BUN_TMPDIR, output: process.env.AIDLC_PROJECT_DIR }) + "\\n");` });
  setRuntimeCallback({ root, text: `require("node:fs").appendFileSync(${JSON.stringify(filesystem.path({ root, relative: "callback-roots.jsonl" }))}, JSON.stringify(ctx.distRoot) + "\\n");` });
};
export const observedRuntimeFixture = (root: string) => {
  const rows = z.array(z.object({ home: z.string(), temp: z.string(), bun: z.string(), output: z.string() })).parse(readLines({ root, relative: "runtime-trace.jsonl" }));
  const outputs = z.array(z.string()).parse(readLines({ root, relative: "callback-roots.jsonl" }));
  const transportRows = z.array(z.object({ owner: z.string().nullable(), distribution: z.string().nullable() })).parse(readLines({ root, relative: "compiler-trace.jsonl" }));
  const session = transportRows.find(row => row.owner !== null)!;
  return { callbackCount: outputs.length, callbackRootsShallow: outputs.every(output => filesystem.observe(output).grandparent === session.distribution), callbackRootsRemoved: outputs.every(output => filesystem.observe(output).presence === "absent"), separateSessionOwners: session.owner !== session.distribution, emissionHomes: new Set(rows.map(row => row.temp)).size, sessions: new Set(rows.map(row => filesystem.observe(row.temp).parent)).size,
    children: rows.map(row => ({ homeMatches: row.home === row.temp && row.bun === row.temp, shallow: filesystem.observe(row.temp).grandparent === filesystem.temporaryRoot, callbackRoot: outputs.includes(row.output), separate: row.temp !== row.output, cleaned: !(filesystem.observe(row.temp).presence === "present") })) };
};
export const failRuntimeFixture = ({ root, kind, message }: { readonly root: string; readonly kind: string; readonly message: string }) => {
  if (kind === "callback") setRuntimeCallback({ root, text: `throw new Error(${JSON.stringify(message)});` });
  if (kind === "stderr") setRuntimeCallback({ root, text: `require("node:fs").appendFileSync(require("node:path").join(ctx.distRoot, ctx.harnessDir, "tools/aidlc-utility.ts"), ${JSON.stringify(`\nconsole.error(${JSON.stringify(message)});\n`)});` });
  if (kind === "mutation") setRuntimeCallback({ root, text: `require("node:fs").appendFileSync(${JSON.stringify(filesystem.path({ root, relative: runtimeModule }))}, "\\n// source changed during callback\\n");` });
};
export const runtimeInputWitness = (root: string) => ({ fingerprint: packageInputsFingerprint(root), inputs: observeProductionInputs(root) });
export const runtimeWitnessContainsCapability = (witness: RuntimeInputWitness) => witness.inputs.some(input => input.path === runtimeModule);
export const changeRuntimeCapability = (root: string) => appendRuntimeSource({ root, relative: runtimeModule, text: "// changed capability input" });
export const verifyRuntimeWitness = ({ before, root }: { readonly before: RuntimeInputWitness; readonly root: string }) => verifyProductionInputs(before.inputs, observeProductionInputs(root));
export const runtimeFixtureText = ({ root, relative }: { readonly root: string; readonly relative: string }) => filesystem.read({ root, relative });
export const runtimeFixtureExists = (root: string) => (filesystem.observe(root).presence === "present");
export const executeConcurrentRuntimeFixture = async (root: string) => {
  setRuntimeCallback({ root, text: 'require("node:fs").mkdirSync(require("node:path").join(ctx.distRoot, "extension-probe"), {recursive:true}); require("node:fs").writeFileSync(require("node:path").join(ctx.distRoot, "extension-probe/session-count.txt"), String(count));' });
  const launches = ["left", "right"].map(label => {
    const copyRoot = filesystem.path({ root, relative: `${label}/copy` }), nativeRoot = filesystem.path({ root, relative: `${label}/native` });
    const program = `const api = await import(Bun.pathToFileURL(${JSON.stringify(filesystem.path({ root, relative: "scripts/project-core.ts" }))}).href); await api.projectCorePublicationSession({sourceRoot:${JSON.stringify(root)},outRoot:${JSON.stringify(copyRoot)},buildVersion:"2.11.3",environmentCap:null},[{binding:{harness:"claude",directory:".claude"},copyRoot:${JSON.stringify(copyRoot)},nativeRoot:${JSON.stringify(nativeRoot)}}]);`;
    return Bun.spawn([process.execPath, "--no-env-file", "--no-install", "--eval", program], { cwd: root, stdout: "pipe", stderr: "pipe", timeout: NATIVE_MULTI_WORKTREE_CASE_TIMEOUT_MS });
  });
  return Promise.all(launches.map(async child => {
    const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
    return { exitCode, stdout, stderr };
  }));
};

export const runtimeConcurrentCounts = (root: string) => ["left/copy", "left/native", "right/copy", "right/native"].map(relative => filesystem.read({ root, relative: `${relative}/extension-probe/session-count.txt` }));

export const createRuntimeSourceFixtures = () => {
  const roots = new Set<string>();
  return {
    create: () => { const root = createRuntimeSourceFixture(); roots.add(root); return root; },
    cleanup: () => { roots.forEach(root => { removeRuntimeSourceFixture(root); }); roots.clear(); },
  };
};

export const instrumentCompilerProcesses = (root: string) => {
  const location = { root, relative: "scripts/projection/src/adapters/native-compiler-process.ts" };
  const original = filesystem.read(location);
  const marker = "const reply = Bun.spawnSync(";
  if (!original.includes(marker)) throw new Error("Compiler transport instrumentation marker is absent");
  const record = `require("node:fs").appendFileSync(${JSON.stringify(filesystem.path({ root, relative: "compiler-trace.jsonl" }))}, JSON.stringify({ env, cwd, owner: input.includes('"runtimeRoot":') ? JSON.parse(input).runtimeRoot : null, distribution: input.includes('"distributionRoot":') ? JSON.parse(input).distributionRoot : null }) + "\\n"); `;
  filesystem.write({ ...location, text: original.replace(marker, record + marker) });
};
export const observedCompilerProcesses = (root: string) => {
  const rows = z.array(z.object({ env: z.record(z.string(), z.string().optional()), cwd: z.string(), owner: z.string().nullable(), distribution: z.string().nullable() })).parse(readLines({ root, relative: "compiler-trace.jsonl" }));
  const outer = rows.filter(row => row.owner !== null);
  const children = rows.filter(row => row.owner === null);
  const owner = outer[0]?.owner;
  const distribution = outer[0]?.distribution;
  return { foreignWork: children.filter(row => row.cwd !== root && filesystem.relationship({ root: distribution!, target: row.cwd }) !== "inside").length, sourceWork: children.filter(row => row.cwd === root).length, distributionWork: children.filter(row => filesystem.relationship({ root: distribution!, target: row.cwd }) === "inside").length, outerCount: outer.length, childCount: children.length, uniqueHomes: new Set(children.map(row => row.env["HOME"])).size,
    outerWorkspacePreserved: outer.every(row => row.cwd === row.env["TEMP"] && row.env["TEMP"] !== row.owner),
    children: children.map(row => ({ explicitOwner: filesystem.observe(row.env["HOME"]!).parent === owner, homeMatches: ["TEMP", "TMP", "TMPDIR", "BUN_TMPDIR"].every(name => row.env[name] === row.env["HOME"]), isolatedFromWork: row.cwd !== row.env["HOME"], workRecognized: row.cwd === root || filesystem.relationship({ root: distribution!, target: row.cwd }) === "inside", cleaned: filesystem.observe(row.env["HOME"]!).presence === "absent" })) };
};

export const runtimeWitnessContainsProcess = (witness: RuntimeInputWitness) => witness.inputs.some(input => input.path === "scripts/projection/src/adapters/child-runtime-process.ts");
export const changeRuntimeProcess = (root: string) => appendRuntimeSource({ root, relative: "scripts/projection/src/adapters/child-runtime-process.ts", text: "// changed process capability input" });

export const requireExplicitDistributionFixture = (root: string) => {
  const temporary = { root, relative: "scripts/projection/src/adapters/temporary-directory.ts" };
  const source = filesystem.read(temporary);
  const marker = "export const createTemporaryDirectoryOperations = (): TemporaryDirectoryOperations => {";
  if (!source.includes(marker)) throw new Error("Standalone directory instrumentation marker is absent");
  filesystem.write({ ...temporary, text: source.replace(marker, marker + '\n throw new Error("Retained composition reached the standalone ambient directory allocator");') });
  const fresh = { root, relative: "scripts/projection/src/adapters/fresh-core-assembly.ts" };
  const program = filesystem.read(fresh);
  const selected = "const directories = createDistributionDirectoryFactory({ parent: request.distributionRoot });";
  if (!program.includes(selected)) throw new Error("Fresh distribution instrumentation marker is absent");
  filesystem.write({ ...fresh, text: program.replace(selected, selected + '\n process.env.TEMP = request.distributionRoot + "/unallocated-ambient-temp"; process.env.TMP = process.env.TEMP; process.env.BUN_TMPDIR = process.env.TEMP;') });
};
export const runtimeWitnessPaths = (witness: RuntimeInputWitness) => witness.inputs.map(input => input.path);
