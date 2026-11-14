import type { HostIdentity } from "../../kernel/host.ts";
import { asFolder } from "../../kernel/file-system-port.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import { identicalRootConflicts } from "../domain/identical-root-conflicts.ts";
import { strayOutputs } from "../domain/stray-outputs.ts";
import { treeDifferences } from "../domain/tree-differences.ts";
import type { Payload } from "../domain/payload.ts";
import type { DistributionBuildFailure, DistributionPayloads, DistributionPlugins,
  OutputTrees, PackageDistributions, PackagedSources } from "./ports.ts";

type DistributionPorts = {
  readonly payloads: DistributionPayloads;
  readonly plugins: DistributionPlugins;
  readonly outputs: OutputTrees;
  readonly sources: PackagedSources;
  readonly prepare: (request: { readonly hosts: readonly HostIdentity[] }) =>
    Promise<Result<void, readonly DistributionBuildFailure[]>>;
};
type PassRequest = {
  readonly ports: Omit<DistributionPorts, "prepare">;
  readonly root: URL;
  readonly hosts: readonly HostIdentity[];
};

const removeEntries = async (request: { readonly outputs: OutputTrees; readonly entries: readonly URL[] }):
  Promise<Result<void, readonly DistributionBuildFailure[]>> => {
  return request.entries.reduce<Promise<Result<void, readonly DistributionBuildFailure[]>>>(async (pending, entry) => {
    const previous = await pending;
    if (!previous.ok) return previous;
    const removed = await request.outputs.remove(entry);
    return removed.ok ? accepted(undefined) : refused([removed.refusal]);
  }, Promise.resolve(accepted(undefined)));
};

const removeStrays = async (request: {
  readonly outputs: OutputTrees; readonly folder: URL; readonly expected: readonly string[];
}): Promise<Result<void, readonly DistributionBuildFailure[]>> => {
  const present = await request.outputs.list(request.folder);
  return present.ok ? removeEntries({ outputs: request.outputs,
    entries: strayOutputs({ present: present.value, expected: request.expected })
      .map((name) => new URL(encodeURIComponent(name), request.folder)) }) : refused([present.refusal]);
};

const sweepOutputs = async (request: PassRequest & { readonly sweep: "full" | "named" }):
  Promise<Result<void, readonly DistributionBuildFailure[]>> => {
  const copy = new URL("dist/", asFolder(request.root));
  if (request.sweep === "named") return removeEntries({ outputs: request.ports.outputs,
    entries: request.ports.plugins.directories.flatMap((plugin) => request.hosts.map((host) =>
      new URL(`plugins/${encodeURIComponent(plugin)}/${encodeURIComponent(host.distribution)}`, copy))) });
  const copied = await removeStrays({ outputs: request.ports.outputs, folder: copy,
    expected: [...request.hosts.map((host) => host.distribution), "plugins"] });
  if (!copied.ok) return copied;
  const native = await removeStrays({ outputs: request.ports.outputs,
    folder: new URL("dist-release/", asFolder(request.root)),
    expected: request.hosts.map((host) => host.distribution) });
  return native.ok ? removeEntries({ outputs: request.ports.outputs, entries: [new URL("plugins", copy)] }) : native;
};

const writePair = async (request: PassRequest & { readonly host: HostIdentity }):
  Promise<Result<{ readonly copy: Payload; readonly native: Payload }, readonly DistributionBuildFailure[]>> => {
  const copyRoot = new URL(`dist/${encodeURIComponent(request.host.distribution)}/`, asFolder(request.root));
  const nativeRoot = new URL(`dist-release/${encodeURIComponent(request.host.distribution)}/`, asFolder(request.root));
  const copy = await request.ports.payloads({ host: request.host, channel: "copy", projectRoot: copyRoot, copy: null });
  if (!copy.ok) return copy;
  const copied = await request.ports.outputs.writePayload({ payload: copy.value,
    root: copyRoot });
  if (!copied.ok) return refused([copied.refusal]);
  const native = await request.ports.payloads({ host: request.host, channel: "native", projectRoot: nativeRoot,
    copy: copy.value });
  if (!native.ok) return native;
  const written = await request.ports.outputs.writePayload({ payload: native.value,
    root: nativeRoot });
  return written.ok ? accepted({ copy: copy.value, native: native.value }) : refused([written.refusal]);
};

const buildPass = async (request: PassRequest): Promise<Result<void, readonly DistributionBuildFailure[]>> => {
  const captured = await request.hosts.reduce<Promise<Result<{
    readonly copies: readonly Payload[]; readonly natives: readonly Payload[];
  }, readonly DistributionBuildFailure[]>>>(async (pending, host) => {
    const previous = await pending;
    if (!previous.ok) return previous;
    const pair = await writePair({ ...request, host });
    if (!pair.ok) return pair;
    return accepted({ copies: [...previous.value.copies, pair.value.copy], natives: [...previous.value.natives, pair.value.native] });
  }, Promise.resolve(accepted({ copies: [], natives: [] })));
  if (!captured.ok) return captured;
  const pairs = captured.value;
  const copied = identicalRootConflicts({ payloads: pairs.copies });
  if (copied.length > 0) return refused(copied);
  const native = identicalRootConflicts({ payloads: pairs.natives });
  if (native.length > 0) return refused(native);
  const output = new URL("dist/", asFolder(request.root));
  return request.ports.plugins.build({ hosts: request.hosts, output, boundary: output });
};

const comparePasses = async (request: { readonly outputs: OutputTrees; readonly first: URL; readonly second: URL }):
  Promise<Result<readonly string[], readonly DistributionBuildFailure[]>> => {
  return ["dist", "dist-release"].reduce<Promise<Result<readonly string[], readonly DistributionBuildFailure[]>>>(async (pending, prefix) => {
    const previous = await pending;
    if (!previous.ok) return previous;
    const first = await request.outputs.read(new URL(`${prefix}/`, asFolder(request.first)));
    if (!first.ok) return refused([first.refusal]);
    const second = await request.outputs.read(new URL(`${prefix}/`, asFolder(request.second)));
    if (!second.ok) return refused([second.refusal]);
    return accepted([...previous.value, ...treeDifferences({ first: first.value, second: second.value, prefix })]);
  }, Promise.resolve(accepted([])));
};

const checkPasses = async (request: PassRequest & { readonly second: URL; readonly builtFrom: string }):
  Promise<Result<{ readonly problems: readonly string[]; readonly inputs: "unchanged" | "inputs-changed" },
    readonly DistributionBuildFailure[]>> => {
  const first = await buildPass(request);
  if (!first.ok) return first;
  const second = await buildPass({ ...request, root: request.second });
  if (!second.ok) return second;
  const compared = await comparePasses({ outputs: request.ports.outputs, first: request.root, second: request.second });
  if (!compared.ok) return compared;
  if (compared.value.length > 0) return accepted({ problems: compared.value, inputs: "unchanged" });
  const checked = await request.ports.sources.fingerprint();
  return checked.ok ? accepted({ problems: [],
    inputs: checked.value === request.builtFrom ? "unchanged" : "inputs-changed" })
    : refused([checked.refusal]);
};

const cleanup = async (request: { readonly outputs: OutputTrees; readonly roots: readonly URL[] }):
  Promise<readonly DistributionBuildFailure[]> => {
  return request.roots.reduce<Promise<readonly DistributionBuildFailure[]>>(async (pending, root) => {
    const failures = await pending;
    const removed = await request.outputs.remove(root);
    return removed.ok ? failures : [...failures, removed.refusal];
  }, Promise.resolve([]));
};

const scratchCheck = async (ports: DistributionPorts, request: {
  readonly hosts: readonly HostIdentity[]; readonly builtFrom: string;
}) => {
  const first = await ports.outputs.scratch();
  if (!first.ok) return refused([first.refusal]);
  const second = await ports.outputs.scratch();
  if (!second.ok) return refused([second.refusal,
    ...await cleanup({ outputs: ports.outputs, roots: [first.value] })]);
  let removed: readonly DistributionBuildFailure[] = [];
  const checked = await checkPasses({ ports, hosts: request.hosts, root: first.value,
    second: second.value, builtFrom: request.builtFrom }).finally(async () => {
      removed = await cleanup({ outputs: ports.outputs, roots: [first.value, second.value] });
    });
  return removed.length > 0 ? refused([...(checked.ok ? [] : checked.refusal), ...removed]) : checked;
};

export const createPackageDistributions = (ports: DistributionPorts): PackageDistributions => ({
  build: async ({ hosts, sweep, refusals }) => {
    if (refusals.length > 0) return refused(refusals);
    const fingerprint = await ports.sources.fingerprint();
    if (!fingerprint.ok) return refused([fingerprint.refusal]);
    const prepared = await ports.prepare({ hosts });
    if (!prepared.ok) return prepared;
    const forgotten = await ports.sources.forget(hosts.map((host) => host.distribution));
    if (!forgotten.ok) return refused([forgotten.refusal]);
    const swept = await sweepOutputs({ ports, root: ports.outputs.root, hosts, sweep });
    if (!swept.ok) return swept;
    const built = await buildPass({ ports, root: ports.outputs.root, hosts });
    if (!built.ok) return built;
    const recorded = await ports.sources.record({ hosts: hosts.map((host) => host.distribution),
      builtFrom: fingerprint.value });
    return recorded.ok ? accepted({ record: recorded.value }) : refused([recorded.refusal]);
  },
  check: async ({ hosts, refusals }) => {
    if (refusals.length > 0) return refused(refusals);
    const fingerprint = await ports.sources.fingerprint();
    if (!fingerprint.ok) return refused([fingerprint.refusal]);
    const prepared = await ports.prepare({ hosts });
    if (!prepared.ok) return prepared;
    return scratchCheck(ports, { hosts, builtFrom: fingerprint.value });
  },
});
