import type { RunnerDiscovery, GeneratedRunner, RunnerInputDigest, RunnerDirectoryInput, DiscoveredRunners, RunnerRequirementScope, RunnerInputSnapshot } from "../domain/generated-runner.ts";
import type { SourceOrigin } from "../domain/source-origin.ts";
import { finding, sourceKey, type Outcome, type pathStatus } from "../domain/model.ts";
export type NativeRunnerRequirementRules = { readonly path: typeof pathStatus; readonly digest: (input: { readonly bytes: Uint8Array }) => string };
export type NativeRunnerRequirements = { readonly scope: RunnerRequirementScope; readonly compiler: SourceOrigin; readonly skillRoot: string; readonly inputs: readonly RunnerInputDigest[]; readonly directoryInputs: readonly RunnerDirectoryInput[]; readonly paths: readonly string[]; readonly runners: readonly GeneratedRunner[] };
export const nativeProducerRequiredPaths = ({ requirements, stageDocuments = [] }: { readonly requirements: NativeRunnerRequirements; readonly stageDocuments?: readonly string[] }): readonly string[] => [...new Set([...requirements.paths, ...requirements.inputs.map((input) => input.path), ...stageDocuments])];
const nativeInputPath = ({ path, inputSnapshot }: { readonly path: string; readonly inputSnapshot: RunnerInputSnapshot }): "input" | "other" => ["harness.json", "stage-graph.json", "scope-grid.json"].some((name) => path === `${inputSnapshot.binding.directory}/tools/data/${name}`) || path.startsWith(`${inputSnapshot.binding.directory}/scopes/`) && !path.slice(`${inputSnapshot.binding.directory}/scopes/`.length).includes("/") && path.endsWith(".md") ? "input" : "other";
const bindNativeRunnerRequirements = ({ snapshot, inputSnapshot, rules }: { readonly snapshot: DiscoveredRunners; readonly inputSnapshot: RunnerInputSnapshot; readonly rules: NativeRunnerRequirementRules }): Outcome<NativeRunnerRequirements> => {
  if (snapshot.binding.harness !== inputSnapshot.binding.harness || snapshot.binding.directory !== inputSnapshot.binding.directory || sourceKey(snapshot.compiler.source) !== sourceKey(inputSnapshot.basis.source) || snapshot.compiler.pin !== inputSnapshot.basis.pin)
    return { status: "invalid", findings: [finding({ code: "foreign-content", subject: snapshot.compiler.path, detail: "native requirements must come from the input snapshot's harness and compiler source basis" })] };
  const expected = inputSnapshot.files.filter((file) => nativeInputPath({ path: file.path, inputSnapshot }) === "input");
  const mismatches = snapshot.inputs.filter((input) => { const file = expected.find((candidate) => candidate.path === input.path); return file === undefined || rules.digest({ bytes: file.bytes }) !== input.sha256; });
  const missing = expected.filter((file) => !snapshot.inputs.some((input) => input.path === file.path));
  const mandatory = ["harness.json", "stage-graph.json", "scope-grid.json"].filter((name) => !snapshot.inputs.some((input) => input.path === `${inputSnapshot.binding.directory}/tools/data/${name}`));
  const expectedDirectories = ["skills", "scopes"].map((name) => `${inputSnapshot.binding.directory}/${name}`);
  const changedDirectories = snapshot.directoryInputs.filter((input) => {
    const status = inputSnapshot.directories.some((directory) => directory.path === input.path) || inputSnapshot.files.some((file) => file.path.startsWith(`${input.path}/`)) ? "present" : inputSnapshot.files.some((file) => file.path === input.path) ? "file" : "absent";
    return !expectedDirectories.includes(input.path) || status !== input.status;
  });
  const missingDirectories = expectedDirectories.filter((path) => !snapshot.directoryInputs.some((input) => input.path === path));
  if (mismatches.length > 0 || missing.length > 0 || mandatory.length > 0 || changedDirectories.length > 0 || missingDirectories.length > 0)
    return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "native-runner-inputs", detail: "native runner inputs differ from the input snapshot; reload requirements and their input snapshot together before reconciling" })] };
  const paths = snapshot.runners.map((runner) => `${snapshot.skillRoot}/${runner.name}/SKILL.md`);
  const invalidPaths = paths.filter((path) => rules.path({ path }) === "unsafe").map((path) => finding({ code: "invalid-destination", subject: path, detail: "native runner requirements must name safe relative entrypoints" }));
  if (invalidPaths.length > 0) return { status: "invalid", findings: invalidPaths };
  if (new Set(paths).size !== paths.length) return { status: "invalid", findings: [finding({ code: "destination-collision", subject: "native-runner-requirements", detail: "different native definitions cannot claim one runner entrypoint" })] };
  return { status: "ok", value: { scope: snapshot.scope, compiler: snapshot.compiler, skillRoot: snapshot.skillRoot, inputs: snapshot.inputs, directoryInputs: snapshot.directoryInputs, paths, runners: snapshot.runners } };
};
export const discoverNativeRunnerRequirements = ({ discovery, inputSnapshot, rules }: { readonly discovery: RunnerDiscovery; readonly inputSnapshot: RunnerInputSnapshot; readonly rules: NativeRunnerRequirementRules }): Outcome<NativeRunnerRequirements> => {
  const discovered = discovery.discover();
  return discovered.status === "invalid" ? discovered : bindNativeRunnerRequirements({ snapshot: discovered.value, inputSnapshot, rules });
};
