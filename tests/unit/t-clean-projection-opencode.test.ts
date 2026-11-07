// covers: file:harness/opencode/settings.ts, file:scripts/projection/src/adapters/source-opencode-settings.ts, file:scripts/projection/src/adapters/fresh-core-assembly.ts
import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, copyFileSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { deserialize, serialize } from "node:v8";
import manifest from "../../harness/opencode/manifest.ts";
import { prepareOpenCodeSurfaces } from "../../harness/opencode/settings.ts";
import { qualifiedHarnessProfile, qualifiedDeliveryContext } from "../../scripts/projection/src/adapters/qualified-harness-profile.ts";
import { qualifyDeliveryDeclaration } from "../../scripts/projection/src/adapters/qualified-delivery-policy.ts";
import { createOpencodeAgentEmitter } from "../../scripts/projection/src/adapters/opencode-agent.ts";
import { observeOpenCodeInputs } from "../../scripts/projection/src/adapters/opencode-source-contract.ts";
import { admitOpenCodeSettings, prepareSourceOpenCodeSettings } from "../../scripts/projection/src/adapters/source-opencode-settings.ts";
import { createCoreAgentPolicyReader } from "../../scripts/projection/src/adapters/core-agent-policy.ts";
import { assembleFreshCore, materializeArtifactData, ordinaryArtifactData, admitIssuedCoreArtifact } from "../../scripts/projection/src/adapters/fresh-core-assembly.ts";
import { assertPlainSourceData } from "../../scripts/projection/src/adapters/plain-source-data.ts";
import { observeProductionInputs } from "../../scripts/projection/src/adapters/source-input-contract.ts";
import { assembleCoreCopy } from "../../scripts/project-core.ts";
const sourceRoot = join(import.meta.dir, "../.."), binding = { harness: "opencode", directory: ".aidlc" } as const;
const basis = { source: { kind: "core", id: "framework" }, pin: "a".repeat(40) } as const;
const files = [".aidlc/tools/aidlc.ts", ".aidlc/tools/aidlc-executable-path.ts", ".aidlc/hooks/example.ts", ".aidlc/tools/nested/not-an-entry.ts"];
const read = (path: string) => readFileSync(join(sourceRoot, "harness/opencode", path), "utf8");
const surfaceInput = { files, adapter: read("plugin/aidlc-opencode-adapter.ts"), command: read("command/aidlc.md"), config: read("opencode.json") };

test("OpenCode selects its own shell, split onboarding and ordered root ownership", () => {
  const profile = qualifiedHarnessProfile(binding)!;
  expect(profile.harness).toBe("opencode"); expect(profile.skillRoot).toBe(".aidlc/skills");
  expect(profile.onboardingDestinations).toEqual(["AGENTS.md", ".aidlc/onboarding.md"]);
  expect(profile.projectedRootPaths).toEqual(["AGENTS.md", "opencode.json"]); expect(profile.runtimeMappings).toEqual([]);
  expect(manifest.emit).toBeNull(); expect(() => qualifyDeliveryDeclaration(manifest, profile)).not.toThrow();
  for (const invocation of ["aidlc", "bun .aidlc/tools/aidlc.ts"]) expect(qualifiedDeliveryContext({ ...binding, invocation })).toBe(true);
  for (const [path, changes] of [["AGENTS.md", { shared: undefined }], ["opencode.json", { policy: "whole-file" }], [".gitignore", { shared: "identical" }]] as const) expect(() => qualifyDeliveryDeclaration({ ...manifest, rootIntegrations: manifest.rootIntegrations.map(root => root.path === path ? { ...root, ...changes } : root) }, profile)).toThrow();
});
for (const invocation of ["aidlc", "bun .aidlc/tools/aidlc.ts"]) test("OpenCode complete shell keeps final inventory and ordered config: " + invocation, () => {
  const result = prepareOpenCodeSurfaces({ ...surfaceInput, invocation });
  expect(result.map(file => file.path)).toEqual([".opencode/plugin/aidlc-opencode-adapter.ts", ".opencode/command/aidlc.md", "opencode.json"]);
  const adapter = result[0]!.text;
  expect(adapter).toContain('"../../.aidlc/tools/aidlc-executable-path.ts"'); expect(adapter).not.toContain("tools/nested/not-an-entry.ts");
  const list = JSON.parse(adapter.match(/\/\* @aidlc-shipped-entrypoints@ \*\/ (\[[\s\S]*?\])/)! [1]!);
  expect(list).toEqual(["hooks/example.ts", "tools/aidlc-executable-path.ts", "tools/aidlc.ts"]);
  const config = JSON.parse(result[2]!.text);
  expect(Object.keys(config.permission.bash)).toEqual(["rm -r*", "git push *", invocation === "aidlc" ? "aidlc engine *" : "bun .aidlc/tools/*"]);
  expect(result[1]!.text).not.toContain("{{INVOKE}}");
});
test("OpenCode shell refuses missing markers, duplicate entries and undeclared imports", () => {
  for (const adapter of [surfaceInput.adapter.replace("/* @aidlc-shipped-entrypoints@ */ []", "[]"), surfaceInput.adapter + "\n/* @aidlc-shipped-entrypoints@ */ []", 'import "../../../core/tools/aidlc-version.ts";\n' + surfaceInput.adapter]) expect(() => prepareOpenCodeSurfaces({ ...surfaceInput, adapter, invocation: "aidlc" })).toThrow();
  expect(() => prepareOpenCodeSurfaces({ ...surfaceInput, files: [...files, files[0]!], invocation: "aidlc" })).toThrow();
});
test("OpenCode personas retain compiled knowledge in both twins with native steps and variant", () => {
  const result = createOpencodeAgentEmitter().emit({ origin: { ...basis, path: "core/agents/aidlc-review-agent.md" }, binding, name: "aidlc-review-agent", description: "Review", frontmatter: "name: aidlc-review-agent\ndisallowedTools: Task\ntier: balanced\nmaxTurns: 17", body: "Compiled knowledge: use `maxTurns: 17`", preflight: "Read first", nativeModel: { model: null, effort: "medium" }, policy: { tools: { kind: "inherit" }, turnLimit: 17, ambientInstructions: "inherit" } });
  expect(result.status).toBe("ok"); if (result.status !== "ok") return;
  expect(result.value).toHaveLength(2); const native = result.value[0]!.body, engine = result.value[1]!.body;
  expect(native).toContain("variant: medium"); expect(native).toContain("steps: 17"); expect(native).toContain("  task: deny"); expect(native).not.toContain("maxTurns:");
  for (const body of [native, engine]) expect(body).toContain("Compiled knowledge"); expect(engine).toContain("maxTurns: 17");
});
function fixture() {
  const outer = mkdtempSync(join(tmpdir(), "opencode-source-policy-")), source = join(outer, "source"), root = join(outer, "work"); mkdirSync(source); mkdirSync(root);
  for (const input of observeOpenCodeInputs(sourceRoot)) { const file = join(source, input.path); mkdirSync(dirname(file), { recursive: true }); copyFileSync(join(sourceRoot, input.path), file); }
  symlinkSync(join(sourceRoot, "node_modules"), join(source, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  return { outer, source, root, request: { sourceRoot: source, root, basis, binding, mode: 0o644, invocation: "aidlc", files } };
}
test("OpenCode settings really evaluate A/B/A at the same path with independent witnesses", () => {
  const f = fixture(); try {
    const file = join(f.source, "harness/opencode/command/aidlc.md"), original = readFileSync(file, "utf8"), modified = original + "\nQualification B\n";
    for (const content of [original, modified, original]) { writeFileSync(file, content, "utf8"); const prepared = prepareSourceOpenCodeSettings(f.request, process.execPath); if (prepared.status !== "ok") throw new Error(JSON.stringify(prepared)); expect(new TextDecoder().decode(prepared.value.files[1]!.bytes).includes("Qualification B")).toBe(content === modified); expect(prepared.value.preparation.inputs).toEqual(observeOpenCodeInputs(f.source)); expect(readdirSync(f.root)).toEqual([]); }
  } finally { rmSync(f.outer, { recursive: true, force: true }); }
}, 30000);
test("OpenCode raw policy getters/classes/toJSON are refused before JSON, including manifest data", () => {
  const f = fixture(); try {
    const file = join(f.source, "harness/opencode/settings.ts");
    for (const result of ['({ get files() { throw new Error("getter ran"); } })', 'new (class Result { value = "bad" })()', '({ toJSON() { return []; } })']) { writeFileSync(file, "export const prepareOpenCodeSurfaces = () => " + result + ";\n", "utf8"); expect(prepareSourceOpenCodeSettings(f.request, process.execPath).status).toBe("invalid"); expect(readdirSync(f.root)).toEqual([]); }
  } finally { rmSync(f.outer, { recursive: true, force: true }); }
}, 30000);
test("settings witness omission, addition, duplicates, stale and unsafe paths refuse", () => {
  const inputs = [{ path: "harness/opencode/settings.ts", sha256: "a".repeat(64) }], values = prepareOpenCodeSurfaces({ ...surfaceInput, invocation: "aidlc" });
  expect(admitOpenCodeSettings({ files: values, inputs }, inputs, 0o644).status).toBe("ok");
  for (const changed of [[], [...inputs, ...inputs], [...inputs, { path: "other", sha256: "b".repeat(64) }], [{ path: "../escape", sha256: "a".repeat(64) }], [{ ...inputs[0]!, sha256: "b".repeat(64) }]]) expect(admitOpenCodeSettings({ files: values, inputs: changed }, inputs, 0o644).status).toBe("invalid");
});
test("raw source and artifact transport never invoke getters or erase unsupported structure", () => {
  let reads = 0; const getter = { get data() { reads++; return "bad"; } };
  const decorated = Object.assign(new Uint8Array([1]), { extra: true });
  for (const candidate of [getter, new Map(), new Date(), Object.assign([1], { extra: true }), new Array(2), { toJSON: () => ({}) }]) { expect(() => assertPlainSourceData(candidate)).toThrow(); expect(() => ordinaryArtifactData(candidate)).toThrow(); }
  expect(materializeArtifactData(decorated)).toEqual(new Uint8Array([1])); expect(reads).toBe(0);
  expect(() => ordinaryArtifactData({ bytes: new Uint8Array([1, 2]), records: [null, 1, "two"] })).not.toThrow();
});
test("OpenCode raw variant policy uses a fresh private process and never admits effort aliases", async () => {
  const outer = mkdtempSync(join(tmpdir(), "opencode-tier-")), source = join(outer, "source"), workRoot = join(outer, "work"); mkdirSync(join(source, "core/tools"), { recursive: true }); mkdirSync(workRoot);
  try {
    const path = join(source, "core/tools/aidlc-tiers.ts"), reader = createCoreAgentPolicyReader({ workRoot });
    for (const variant of ["medium", "high", "medium"]) { writeFileSync(path, 'export const readMemoryCap = () => null;\nexport const projectTier = () => ({model: null, variant: "' + variant + '"});\n', "utf8"); const result = await reader.load({ sourceRoot: source, basis, binding }); expect(result.status).toBe("ok"); if (result.status === "ok") expect(result.value.models.tiers.balanced.effort).toBe(variant); expect(readdirSync(workRoot)).toEqual([]); }
    writeFileSync(path, 'export const readMemoryCap = () => null;\nexport const projectTier = () => ({model: null, effort: "medium"});\n', "utf8"); expect((await reader.load({ sourceRoot: source, basis, binding })).status).toBe("invalid");
  } finally { rmSync(outer, { recursive: true, force: true }); }
}, 30000);
test("fresh assembly transport validates issued bytes, archive, ownership, projection and request profile", async () => {
  const outer = mkdtempSync(join(tmpdir(), "opencode-issued-"));
  try {
    const artifact = await assembleCoreCopy({ sourceRoot, outRoot: join(outer, "unused"), buildVersion: "2.11.3", environmentCap: null }, binding), archive = join(outer, "check.tar.gz"), pin = artifact.distribution.seed.pin, evaluation = artifact.evaluation!;
    const admitted = admitIssuedCoreArtifact(artifact, binding, pin, archive, evaluation); expect(admitted).not.toBe(artifact); expect(admitted.distribution.files).toEqual(artifact.distribution.files);
    for (const mutate of [(value: typeof artifact) => { value.distribution.files[0]!.bytes[0] ^= 1; }, (value: typeof artifact) => { value.archive[0] ^= 1; }, (value: typeof artifact) => { Object.assign(value, { ownershipJson: "{}" }); }, (value: typeof artifact) => { Object.assign(value.projection.resources[0]!, { body: "wrong" }); }, (value: typeof artifact) => { Object.assign(value.distribution, { retained: [...value.distribution.retained, "bogus"] }); }]) { const candidate = deserialize(serialize(artifact)) as typeof artifact; mutate(candidate); expect(() => admitIssuedCoreArtifact(candidate, binding, pin, archive, evaluation)).toThrow(); }
    for (const changes of [{ delivery: "native" }, { environmentCap: "templated" }, { buildVersion: "2.11.4" }] as const) expect(() => admitIssuedCoreArtifact(artifact, binding, pin, archive, { ...evaluation, ...changes })).toThrow();
  } finally { rmSync(outer, { recursive: true, force: true }); }
}, 180000);

test("public assembly accepts source beneath tmpdir, rejects actual overlap and cleans its workspace", async () => {
  const outer = mkdtempSync(join(tmpdir(), "opencode-temp-checkout-")), source = join(outer, "source"); mkdirSync(source);
  try {
    for (const input of observeProductionInputs(sourceRoot)) { const file = join(source, input.path); mkdirSync(dirname(file), { recursive: true }); copyFileSync(join(sourceRoot, input.path), file); }
    symlinkSync(join(sourceRoot, "node_modules"), join(source, "node_modules"), process.platform === "win32" ? "junction" : "dir");
    const request = { sourceRoot: source, outRoot: join(outer, "unused"), buildVersion: "2.11.3", environmentCap: null }, before = readdirSync(tmpdir()).filter(name => name.startsWith("aidlc-core-evaluation-"));
    const artifact = await assembleCoreCopy(request, binding); expect(artifact.distribution.binding.harness).toBe("opencode");
    expect(readdirSync(tmpdir()).filter(name => name.startsWith("aidlc-core-evaluation-"))).toEqual(before);
    const nested = join(source, "work"); mkdirSync(nested);
    for (const workRoot of [source, outer, nested]) await expect(assembleFreshCore({ request, binding, delivery: "copy", workRoot })).rejects.toThrow("separate working root");
    const marker = join(outer, "executed"), outside = join(outer, "outside.ts");
    writeFileSync(outside, 'import { writeFileSync } from "node:fs"; writeFileSync(' + JSON.stringify(marker) + ', "bad");', "utf8");
    const manifestPath = join(source, "harness/opencode/manifest.ts"); writeFileSync(manifestPath, 'import "../../../outside.ts";\n' + readFileSync(manifestPath, "utf8"), "utf8");
    await expect(assembleCoreCopy(request, binding)).rejects.toThrow("escaped its source root"); expect(existsSync(marker)).toBe(false);
    expect(readdirSync(tmpdir()).filter(name => name.startsWith("aidlc-core-evaluation-"))).toEqual(before);
  } finally { rmSync(outer, { recursive: true, force: true }); }
}, 30000);

test("opaque artifact bytes use internal slots without callbacks or metadata transfer", () => {
  let callbacks = 0; const bytes = new Uint8Array([7, 8, 9]);
  for (const key of ["length", "buffer", "byteOffset", "byteLength", "constructor", "toJSON"]) Object.defineProperty(bytes, key, { get() { callbacks++; throw new Error(key); }, enumerable: true });
  for (const key of [Symbol.iterator, Symbol.toStringTag]) Object.defineProperty(bytes, key, { get() { callbacks++; throw new Error("symbol getter"); } });
  const shared = { bytes }, input = { first: shared, second: shared }, snapshot = materializeArtifactData(input) as typeof input;
  expect(snapshot).not.toBe(input); expect(snapshot.first).toBe(snapshot.second); expect(snapshot.first.bytes).not.toBe(bytes); expect([...snapshot.first.bytes]).toEqual([7, 8, 9]);
  expect(Object.getOwnPropertyNames(snapshot.first.bytes)).toEqual(["0", "1", "2"]); expect(Object.getOwnPropertySymbols(snapshot.first.bytes)).toEqual([]); expect(callbacks).toBe(0);
  const buffer = Buffer.from([0, 3, 4, 0]).subarray(1, 3); expect(materializeArtifactData(buffer)).toEqual(new Uint8Array([3, 4]));
});
test("raw admission refuses proxy traps, disguised sparse arrays, shared/detached bytes and cycles", () => {
  let traps = 0; const handler = { getPrototypeOf() { traps++; throw new Error("trap"); }, ownKeys() { traps++; throw new Error("trap"); } };
  const revoked = Proxy.revocable({}, {}); revoked.revoke(); const sparse = new Array(1); Object.defineProperty(sparse, "4294967295", { value: 0, enumerable: true });
  for (const value of [new Proxy({}, handler), new Proxy(new Uint8Array(1), handler), revoked.proxy, sparse]) { expect(() => materializeArtifactData(value)).toThrow(); expect(() => assertPlainSourceData(value)).toThrow(); }
  for (const value of [new Int8Array([-1]), new Uint8ClampedArray([7]), new Uint16Array([0x1234]), new Int32Array([1234]), new Float32Array([1.5]), new DataView(new ArrayBuffer(2)), Object.create(null)]) { Object.setPrototypeOf(value, Uint8Array.prototype); expect(() => materializeArtifactData(value)).toThrow(); }
  const shared = new SharedArrayBuffer(2), detached = new ArrayBuffer(2), bytes = new Uint8Array(detached); structuredClone(detached, { transfer: [detached] });
  const cycle: { self?: unknown } = {}; cycle.self = cycle;
  for (const value of [new Uint8Array(shared), Buffer.from(shared), bytes, new (class CustomBytes extends Uint8Array {})(1), cycle]) expect(() => materializeArtifactData(value)).toThrow();
  const resizable = new ArrayBuffer(2, { maxByteLength: 4 }), view = new Uint8Array(resizable); view[0] = 9; const result = materializeArtifactData(view) as Uint8Array;
  if (resizable.resizable) resizable.resize(4); expect([...result]).toEqual([9, 0]); expect(traps).toBe(0);
});
